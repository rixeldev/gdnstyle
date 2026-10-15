import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
})

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    const { amount } = await req.json()

    console.log("💸 Procesando retiro:", { userId: user.id, amount })

    // 1. Obtener el provider y su stripe_account_id
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, stripe_account_id")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      console.error("❌ Error obteniendo provider:", providerError)
      throw new Error("Proveedor no encontrado")
    }

    if (!provider.stripe_account_id) {
      console.error("❌ Provider sin stripe_account_id:", provider.id)
      throw new Error("Proveedor no tiene cuenta de Stripe conectada")
    }

    console.log("✅ Provider encontrado:", {
      id: provider.id,
      stripe_account_id: provider.stripe_account_id,
    })

    // 2. Validar monto
    if (!amount || amount < 10) {
      throw new Error("El monto mínimo de retiro es $10.00")
    }

    // 3. Obtener balance disponible en Stripe
    const balance = await stripe.balance.retrieve({
      stripeAccount: provider.stripe_account_id,
    })

    const availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100

    console.log("💰 Balance disponible:", availableBalance)

    if (amount > availableBalance) {
      throw new Error("Balance insuficiente")
    }

    // 4. Crear el payout (retiro) a la cuenta bancaria del proveedor
    const amountCents = Math.round(amount * 100)

    const payout = await stripe.payouts.create(
      {
        amount: amountCents,
        currency: "usd",
        description: `Retiro de fondos - ${new Date().toLocaleDateString()}`,
      },
      {
        stripeAccount: provider.stripe_account_id,
      },
    )

    console.log("✅ Payout creado:", payout.id, "Status:", payout.status)

    // 5. Guardar el registro en provider_withdrawals con el campo correcto
    const { data: withdrawal, error: insertError } = await supabase
      .from("provider_withdrawals")
      .insert({
        provider_id: provider.id,
        amount: amount,
        stripe_payout_id: payout.id,
        status: payout.status === "paid" ? "completed" : "pending",
        requested_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("❌ Error guardando retiro:", insertError)
      console.error("❌ Detalles del error:", JSON.stringify(insertError, null, 2))
      throw new Error(`Error al guardar el retiro: ${insertError.message}`)
    }

    console.log("✅ Retiro guardado en BD:", {
      id: withdrawal.id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      stripe_payout_id: withdrawal.stripe_payout_id,
    })

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: withdrawal.id,
        payout_id: payout.id,
        amount: amount,
        status: withdrawal.status,
        message: "Retiro procesado exitosamente",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("❌ Error en retiro:", error)
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
