import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
})

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  try {
    const { paymentIntentId, providerId, serviceAmount, platformFee } = await req.json()

    console.log("💸 Procesando transferencia:", {
      paymentIntentId,
      providerId,
      serviceAmount,
      platformFee,
    })

    // 1. Obtener la cuenta de Stripe del proveedor
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("stripe_account_id")
      .eq("id", providerId)
      .single()

    if (providerError || !provider?.stripe_account_id) {
      throw new Error("Proveedor no tiene cuenta de Stripe conectada")
    }

    console.log("✅ Cuenta del proveedor:", provider.stripe_account_id)

    // 2. Verificar que el Payment Intent existe y está pagado
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== "succeeded") {
      throw new Error("El pago aún no ha sido confirmado")
    }

    console.log("✅ Payment Intent confirmado:", paymentIntent.id)

    // 3. Crear la transferencia al proveedor
    const serviceAmountCents = Math.round(serviceAmount * 100)

    const transfer = await stripe.transfers.create({
      amount: serviceAmountCents,
      currency: "usd",
      destination: provider.stripe_account_id,
      transfer_group: paymentIntentId,
      description: `Pago por servicio - Payment Intent: ${paymentIntentId}`,
    })

    console.log("✅ Transferencia creada:", transfer.id)

    // 4. Guardar el registro en la base de datos
    const { error: insertError } = await supabase.from("provider_payments").insert({
      provider_id: providerId,
      payment_intent_id: paymentIntentId,
      transfer_id: transfer.id,
      amount: serviceAmount,
      platform_fee: platformFee,
      status: "completed",
    })

    if (insertError) {
      console.error("Error guardando registro:", insertError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transfer.id,
        amount: serviceAmount,
        provider_received: serviceAmount,
        platform_fee: platformFee,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  } catch (error) {
    console.error("❌ Error en transferencia:", error)
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  }
})
