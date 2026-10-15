import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/**
 * Crea un SetupIntent para el cliente autenticado y devuelve su clientSecret.
 * El frontend confirma con Stripe.js (confirmCardSetup) y la tarjeta queda
 * adjunta al customer de Stripe sin realizar ningún cobro.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured")
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" })

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

    const { shopContext } = await req.json().catch(() => ({ shopContext: "client" }))

    let stripeCustomerId: string | null = null

    if (shopContext === "provider") {
      const { data: provider } = await supabase
        .from("providers")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle()
      stripeCustomerId = provider?.stripe_customer_id ?? null
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle()
      stripeCustomerId = profile?.stripe_customer_id ?? null
    }

    if (!stripeCustomerId) {
      throw new Error(
        "No se encontró el cliente de pago. Primero llama a manage-client-payment-methods con la acción get_or_create_customer.",
      )
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: "off_session",
      automatic_payment_methods: { enabled: true },
    })

    return new Response(
      JSON.stringify({
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    )
  } catch (error) {
    console.error("Error creando setup intent:", error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
