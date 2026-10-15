import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
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

    const {
      amount,
      currency = "usd",
      metadata = {},
      paymentMethodId,
      shopContext: shopContextRaw,
    } = await req.json()
    const shopContext = shopContextRaw === "provider" ? "provider" : "client"

    if (!amount || amount <= 0) {
      throw new Error("Invalid amount")
    }

    const amountCents = Math.round(Number(amount) * 100)

    const paymentIntentData: any = {
      amount: amountCents,
      currency: currency.toLowerCase(),
      metadata: {
        ...metadata,
        client_user_id: user.id,
        flow_type: "shop_checkout",
        shop_context: shopContext,
      },
    }

    if (paymentMethodId) {
      paymentIntentData.payment_method = paymentMethodId
      paymentIntentData.confirm = true
      paymentIntentData.off_session = true

      let stripeCustomerId: string | null = null
      if (shopContext === "provider") {
        const { data: prov } = await supabase
          .from("providers")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle()
        stripeCustomerId = prov?.stripe_customer_id ?? null
      } else {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("stripe_customer_id")
          .eq("id", user.id)
          .maybeSingle()
        stripeCustomerId = profileData?.stripe_customer_id ?? null
      }

      if (stripeCustomerId) {
        paymentIntentData.customer = stripeCustomerId
      }
    } else {
      paymentIntentData.automatic_payment_methods = { enabled: true }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData)

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("Error creating shop payment intent:", error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
