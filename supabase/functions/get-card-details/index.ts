import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error("No autorizado")
    }

    // Obtener datos del proveedor
    const { data: provider, error: providerError } = await supabaseClient
      .from("providers")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      throw new Error("Proveedor no encontrado")
    }

    // Si no tiene tarjeta
    if (!provider.stripe_card_id) {
      return new Response(
        JSON.stringify({
          hasCard: false,
          cardStatus: provider.card_status || "none",
          identityVerified: provider.identity_verified || false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // Obtener detalles de la tarjeta de Stripe
    const stripeAccount = provider.stripe_account_id || undefined
    const card = await stripe.issuing.cards.retrieve(
      provider.stripe_card_id,
      {},
      stripeAccount ? { stripeAccount } : undefined,
    )

    let balance = 0
    if (stripeAccount) {
      try {
        const accountBalance = await stripe.balance.retrieve({}, { stripeAccount })
        const issuingAvailable = accountBalance.issuing?.available || []
        balance = issuingAvailable
          .filter((item) => item.currency === "usd")
          .reduce((sum, item) => sum + item.amount, 0)
      } catch (error) {
        console.error("Error obteniendo balance Issuing:", error)
      }
    }

    const transactions = await stripe.issuing.transactions.list(
      { card: provider.stripe_card_id, limit: 10 },
      stripeAccount ? { stripeAccount } : undefined,
    )

    return new Response(
      JSON.stringify({
        hasCard: true,
        cardStatus: provider.card_status,
        card: {
          id: card.id,
          last4: card.last4,
          brand: card.brand,
          exp_month: card.exp_month,
          exp_year: card.exp_year,
          status: card.status,
          type: card.type,
          cardholder_name: card.cardholder.name,
        },
        balance: balance / 100, // Convertir de centavos a dólares
        transactions: transactions.data.map((tx) => {
          const amountInCents = Math.abs(tx.amount)
          const merchantName = tx.merchant_data?.name || "Desconocido"
          const createdUnix = tx.created
          const createdIso = new Date(createdUnix * 1000).toISOString()

          return {
            id: tx.id,
            amount: amountInCents,
            amount_dollars: amountInCents / 100,
            merchant_name: merchantName,
            merchant: merchantName,
            category: tx.merchant_data?.category || "General",
            created: createdUnix,
            date: createdIso,
            status: tx.type === "capture" ? "completed" : "pending",
          }
        }),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("Error in get-card-details:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
