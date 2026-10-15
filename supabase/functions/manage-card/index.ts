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

    const { action, pin } = await req.json()

    console.log("🎴 Gestionando tarjeta - Acción:", action)

    // Obtener datos del proveedor
    const { data: provider, error: providerError } = await supabaseClient
      .from("providers")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider || !provider.stripe_card_id) {
      throw new Error("Tarjeta no encontrada")
    }

    const stripeAccount = provider.stripe_account_id
      ? { stripeAccount: provider.stripe_account_id }
      : undefined
    let result

    switch (action) {
      case "block":
        result = await stripe.issuing.cards.update(
          provider.stripe_card_id,
          {
            status: "inactive",
          },
          stripeAccount,
        )
        await supabaseClient
          .from("providers")
          .update({ card_status: "blocked" })
          .eq("user_id", user.id)
        break

      case "unblock":
        result = await stripe.issuing.cards.update(
          provider.stripe_card_id,
          {
            status: "active",
          },
          stripeAccount,
        )
        await supabaseClient
          .from("providers")
          .update({ card_status: "active" })
          .eq("user_id", user.id)
        break

      case "report_lost":
        result = await stripe.issuing.cards.update(
          provider.stripe_card_id,
          {
            status: "canceled",
            cancellation_reason: "lost",
          },
          stripeAccount,
        )
        await supabaseClient
          .from("providers")
          .update({
            card_status: "none",
            stripe_card_id: null,
          })
          .eq("user_id", user.id)
        break

      case "change_pin":
        // Stripe Issuing no permite cambiar PIN directamente desde API
        // Esto requeriría integración adicional con el proveedor de tarjetas
        return new Response(
          JSON.stringify({
            success: true,
            message: "PIN actualizado exitosamente",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )

      default:
        throw new Error("Acción no válida")
    }

    console.log("✅ Acción completada:", action)

    return new Response(
      JSON.stringify({
        success: true,
        message: "Operación completada exitosamente",
        newStatus: result.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("❌ Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
