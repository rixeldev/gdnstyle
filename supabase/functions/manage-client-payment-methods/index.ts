import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

import { underRateLimit } from "../_shared/rate-limit.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/**
 * Fallo con causa conocida. El frontend la traduce por `code`, en vez de
 * mostrar el texto de aquí — que sale en español a una interfaz en inglés.
 */
class FunctionFailure extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "FunctionFailure"
    this.code = code
  }
}

type ShopContext = "client" | "provider"

function parseShopContext(body: Record<string, unknown>): ShopContext {
  return body.shopContext === "provider" ? "provider" : "client"
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured")
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    })

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("No authorization header")
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error("Unauthorized")
    }

    // Cada acción habla con la API de Stripe (listar, crear o fijar tarjetas).
    // El presupuesto es amplio porque la propia interfaz lista las tarjetas al
    // cargar la página, pero corta cualquier aluvión automatizado.
    if (!(await underRateLimit(supabase, `payment-methods:${user.id}`, 60, 600))) {
      throw new FunctionFailure("RATE_LIMITED", "Demasiadas operaciones con tarjetas")
    }

    const body = await req.json()
    const { action, email, name, paymentMethodId } = body
    const shopContext = parseShopContext(body)

    if (action === "get_or_create_customer") {
      if (!email) {
        throw new Error("Email is required")
      }

      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      })

      let customerId: string

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id
        console.log(`✅ Cliente existente encontrado: ${customerId}`)
      } else {
        const meta: Record<string, string> = {
          supabase_user_id: user.id,
          shop_context: shopContext,
        }
        if (shopContext === "provider") {
          const { data: prov } = await supabase
            .from("providers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle()
          if (prov?.id) meta.provider_id = String(prov.id)
        }

        const customer = await stripe.customers.create({
          email: email,
          name: name || undefined,
          metadata: meta,
        })
        customerId = customer.id
        console.log(`✅ Nuevo cliente en Stripe: ${customerId}`)
      }

      if (shopContext === "provider") {
        const { error: upErr } = await supabase
          .from("providers")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", user.id)
        if (upErr) {
          console.error("Error guardando stripe_customer_id en providers:", upErr)
          throw new Error("No se pudo guardar el cliente de pago en la cuenta de proveedor")
        }
      } else {
        const { error: upErr } = await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", user.id)
        if (upErr) {
          console.error("Error guardando stripe_customer_id en profiles:", upErr)
          throw new Error("No se pudo guardar el cliente de pago en el perfil")
        }
      }

      return new Response(JSON.stringify({ customerId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    if (action === "list") {
      let stripeCustomerId: string | null = null

      if (shopContext === "provider") {
        const { data: prov } = await supabase
          .from("providers")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle()
        stripeCustomerId = prov?.stripe_customer_id ?? null
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("stripe_customer_id")
          .eq("id", user.id)
          .maybeSingle()
        stripeCustomerId = profile?.stripe_customer_id ?? null
      }

      if (!stripeCustomerId) {
        return new Response(JSON.stringify({ paymentMethods: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      const customer = await stripe.customers.retrieve(stripeCustomerId)
      const defaultPaymentMethodId =
        typeof customer !== "deleted" && customer.invoice_settings?.default_payment_method
          ? customer.invoice_settings.default_payment_method
          : null

      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: "card",
      })

      const sortedMethods = paymentMethods.data.sort((a, b) => {
        if (a.id === defaultPaymentMethodId) return -1
        if (b.id === defaultPaymentMethodId) return 1
        return 0
      })

      return new Response(
        JSON.stringify({
          paymentMethods: sortedMethods.map((pm) => ({
            id: pm.id,
            brand: pm.card?.brand,
            last4: pm.card?.last4,
            exp_month: pm.card?.exp_month,
            exp_year: pm.card?.exp_year,
          })),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      )
    }

    if (action === "delete") {
      if (!paymentMethodId) {
        throw new Error("Payment method ID is required")
      }

      await stripe.paymentMethods.detach(paymentMethodId)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    if (action === "set_default") {
      if (!paymentMethodId) {
        throw new Error("Payment method ID is required")
      }

      let stripeCustomerId: string | null = null

      if (shopContext === "provider") {
        const { data: prov } = await supabase
          .from("providers")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle()
        stripeCustomerId = prov?.stripe_customer_id ?? null
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("stripe_customer_id")
          .eq("id", user.id)
          .maybeSingle()
        stripeCustomerId = profile?.stripe_customer_id ?? null
      }

      if (!stripeCustomerId) {
        throw new FunctionFailure("NO_STRIPE_CUSTOMER", "No se encontró el cliente en Stripe")
      }

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    if (action === "attach") {
      if (!paymentMethodId) {
        throw new Error("Payment method ID is required")
      }

      let stripeCustomerId: string | null = null

      if (shopContext === "provider") {
        const { data: prov } = await supabase
          .from("providers")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle()
        stripeCustomerId = prov?.stripe_customer_id ?? null
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("stripe_customer_id")
          .eq("id", user.id)
          .maybeSingle()
        stripeCustomerId = profile?.stripe_customer_id ?? null
      }

      if (!stripeCustomerId) {
        throw new FunctionFailure("NO_STRIPE_CUSTOMER", "No se encontró el cliente en Stripe")
      }

      // El método ya cobró con éxito: adjuntarlo al cliente es lo que permite
      // ofrecerlo como tarjeta guardada en la próxima reserva. Un método ya
      // adjunto no se vuelve a adjuntar.
      const attached = await stripe.paymentMethods.retrieve(paymentMethodId)
      if (!attached.customer || attached.customer !== stripeCustomerId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId,
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    throw new Error("Invalid action")
  } catch (error) {
    console.error("Error:", error)
    // `code` is what the frontend translates; the message stays for the logs.
    const code = error instanceof FunctionFailure ? { code: error.code } : null
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        ...code,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    )
  }
})
