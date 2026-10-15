import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Obtener el token de autorización
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("No authorization header")
    }

    // Verificar el usuario autenticado
    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error("Unauthorized")
    }

    const { paymentIntentId, customerId, setupFutureUsage } = await req.json()

    if (!paymentIntentId) {
      throw new Error("Payment Intent ID is required")
    }

    // Actualizar el PaymentIntent
    const updateData: any = {}

    if (customerId) {
      updateData.customer = customerId
    }

    if (setupFutureUsage) {
      updateData.setup_future_usage = setupFutureUsage
    }

    const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, updateData)

    console.log(`✅ PaymentIntent actualizado: ${paymentIntent.id}`)
    if (customerId) {
      console.log(`👤 Cliente asociado: ${customerId}`)
    }
    if (setupFutureUsage) {
      console.log(`💳 Setup future usage: ${setupFutureUsage}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("Error updating payment intent:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
