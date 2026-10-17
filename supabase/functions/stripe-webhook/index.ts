import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import Stripe from "https://esm.sh/stripe@14.21.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")
    // Every Stripe endpoint has its own signing secret. STRIPE_WEBHOOK_SECRET_SHOP
    // is the one issued for the endpoint that points at this function;
    // STRIPE_WEBHOOK_SECRET remains as a fallback for setups where both shop
    // webhooks were registered from a single endpoint secret.
    const stripeWebhookSecret =
      Deno.env.get("STRIPE_WEBHOOK_SECRET_SHOP") || Deno.env.get("STRIPE_WEBHOOK_SECRET")

    if (!stripeSecretKey || !stripeWebhookSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Stripe no está configurado",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const body = await req.text()
    const signature = req.headers.get("stripe-signature")

    if (!signature) {
      return new Response(JSON.stringify({ success: false, error: "No signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Signature verified cryptographically, the same way handle-payment-webhook
    // and handle-appointment-payment-webhook already do it. Until now the body
    // was only JSON.parsed: anyone who could reach the URL could post a forged
    // payment_intent.succeeded and make the shop mark a session completed,
    // create an order and hand it to CJ Dropshipping.
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" })
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret)
    } catch (err) {
      console.error("stripe-webhook: firma inválida:", err)
      return new Response(JSON.stringify({ success: false, error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Manejar diferentes tipos de eventos de Stripe
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object

      // Actualizar sesión en la base de datos usando payment_intent_id
      const { data: checkoutSession, error: sessionError } = await supabase
        .from("checkout_sessions")
        .select("*")
        .eq("stripe_payment_intent_id", paymentIntent.id)
        .single()

      if (sessionError || !checkoutSession) {
        console.error("Error obteniendo sesión:", sessionError)
        return new Response(JSON.stringify({ success: false, error: "Sesión no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Actualizar estado de la sesión
      await supabase
        .from("checkout_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", paymentIntent.id)

      // Crear orden en la base de datos
      const orderData = {
        user_id: checkoutSession.user_id,
        stripe_payment_intent_id: paymentIntent.id,
        cart_items: checkoutSession.cart_items,
        shipping_info: checkoutSession.shipping_info,
        total: checkoutSession.total,
        status: "pending_fulfillment",
        created_at: new Date().toISOString(),
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single()

      if (orderError) {
        console.error("Error creando orden:", orderError)
        return new Response(JSON.stringify({ success: false, error: "Error creando orden" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Llamar a función para crear orden en CJDropshipping
      const cjResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "")}/functions/v1/create-cjdropshipping-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            orderId: order.id,
            cartItems: checkoutSession.cart_items,
            shippingInfo: checkoutSession.shipping_info,
          }),
        },
      )

      if (!cjResponse.ok) {
        console.error("Error creando orden en CJ:", await cjResponse.text())
      }
    }

    return new Response(JSON.stringify({ success: true, received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("Error en webhook:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error procesando webhook",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
