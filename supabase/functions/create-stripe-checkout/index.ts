import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { cartItems, shippingInfo } = await req.json()

    if (!cartItems || cartItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "El carrito está vacío",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Stripe no está configurado",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // The order belongs to whoever is signed in. `userId` used to come from the
    // request body, so any caller could stamp any account (or none) into the
    // PaymentIntent metadata and the tracking row; it now comes from the JWT.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Debes iniciar sesión para comprar",
          code: "UNAUTHORIZED",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const userId = user.id

    // Obtener productos de la base de datos para calcular precios
    const productIds = cartItems.map((item: any) => item.productId || item.id)
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds)

    if (productsError || !products) {
      throw new Error("Error al obtener productos")
    }

    // Crear line items para Stripe
    const lineItems = cartItems.map((item: any) => {
      const product = products.find((p: any) => String(p.id) === String(item.productId || item.id))
      if (!product) {
        throw new Error(`Producto ${item.productId || item.id} no encontrado`)
      }

      return {
        price_data: {
          currency: product.currency_code || "usd",
          product_data: {
            name: product.title || product.name,
            description: product.description || "",
            images: product.image_url ? [product.image_url] : [],
          },
          unit_amount: Math.round((product.price || 0) * 100), // Stripe usa centavos
        },
        quantity: item.quantity || 1,
      }
    })

    // Calcular total
    const total = cartItems.reduce((sum: number, item: any) => {
      const product = products.find((p: any) => String(p.id) === String(item.productId || item.id))
      return sum + (product?.price || 0) * (item.quantity || 1)
    }, 0)

    // Crear Payment Intent en Stripe (para móvil)
    // Construir metadata como strings individuales (Stripe no acepta JSON.stringify en metadata)
    const metadataParams = new URLSearchParams({
      amount: String(Math.round(total * 100)), // Stripe usa centavos
      currency: "usd",
      "automatic_payment_methods[enabled]": "true",
      "metadata[userId]": userId,
      "metadata[cartItems]": JSON.stringify(cartItems),
      "metadata[shippingInfo]": JSON.stringify(shippingInfo || {}),
    })

    const stripeResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: metadataParams.toString(),
    })

    const stripeResult = await stripeResponse.json()

    if (!stripeResponse.ok || stripeResult.error) {
      throw new Error(stripeResult.error?.message || "Error al crear payment intent de Stripe")
    }

    // Guardar la sesión en la base de datos para tracking
    const { error: sessionError } = await supabase.from("checkout_sessions").insert({
      stripe_session_id: stripeResult.id,
      stripe_payment_intent_id: stripeResult.id,
      user_id: userId,
      cart_items: cartItems,
      shipping_info: shippingInfo || {},
      total: total,
      status: "pending",
      created_at: new Date().toISOString(),
    })

    if (sessionError) {
      console.error("Error guardando sesión:", sessionError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentIntent: stripeResult.client_secret,
        paymentIntentId: stripeResult.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error: any) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al crear checkout",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
