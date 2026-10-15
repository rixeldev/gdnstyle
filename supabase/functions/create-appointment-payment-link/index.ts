import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-11-20.acacia",
})

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("Usuario no autenticado")
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error("Usuario no autenticado")
    }

    const {
      service_id,
      client_name,
      client_email,
      client_phone,
      scheduled_date,
      scheduled_time,
      notes,
      location_id,
    } = await req.json()

    if (!service_id || !client_name || !client_email || !scheduled_date || !scheduled_time) {
      throw new Error("Faltan datos requeridos")
    }

    const { data: service, error: serviceError } = await supabaseClient
      .from("provider_services")
      .select("id, service_id, name, price")
      .eq("id", service_id)
      .single()

    if (serviceError || !service) {
      throw new Error("Servicio no encontrado")
    }

    const { data: provider, error: providerError } = await supabaseClient
      .from("providers")
      .select("stripe_account_id, full_name")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      throw new Error("Proveedor no encontrado o sin cuenta de Stripe")
    }

    if (!provider.stripe_account_id) {
      throw new Error("El proveedor no tiene cuenta de Stripe configurada")
    }

    const serviceName = service.name || "Servicio"

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${serviceName} - ${scheduled_date} ${scheduled_time}`,
              description: `Cita con ${provider.full_name}`,
            },
            unit_amount: Math.round(service.price * 100),
          },
          quantity: 1,
        },
      ],
      after_completion: {
        type: "hosted_confirmation",
        hosted_confirmation: {
          custom_message: "¡Gracias por tu pago! Tu cita ha sido confirmada.",
        },
      },
      metadata: {
        type: "appointment",
        provider_id: user.id,
        service_id: service_id,
        service_name: serviceName,
        client_name: client_name,
        client_email: client_email,
        client_phone: client_phone || "",
        appointment_date: scheduled_date,
        appointment_time: scheduled_time,
        notes: notes || "",
        location_id: location_id || "",
        price: service.price.toString(),
      },
      application_fee_amount: Math.round(service.price * 100 * 0.1), // 10% comisión
      on_behalf_of: provider.stripe_account_id,
      transfer_data: {
        destination: provider.stripe_account_id,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentLink.url,
        message: "Link de pago creado exitosamente",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno"
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    )
  }
})
