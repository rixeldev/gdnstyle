import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/**
 * Flujo de reembolso de una cita:
 *   - action 'approve' (el profesional aprueba la solicitud): crea el reembolso
 *     en Stripe revirtiendo la transferencia al proveedor y la comisión de la
 *     plataforma, y marca la cita + el pago como reembolsados.
 *   - action 'reject': solo cierra la solicitud en la base de datos.
 * El cliente solicita el reembolso cancelando la cita (refund_status =
 * 'requested'); esta función exige que esa solicitud exista.
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

    const { appointmentId, action, reason } = await req.json()

    if (!appointmentId || (action !== "approve" && action !== "reject")) {
      throw new Error("appointmentId y action (approve|reject) son requeridos")
    }

    // El usuario debe ser el dueño de la cita vía su fila en providers.
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      throw new Error("Proveedor no encontrado")
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, provider_id, refund_status, payment_id, payment_status")
      .eq("id", appointmentId)
      .single()

    if (appointmentError || !appointment || appointment.provider_id !== provider.id) {
      throw new Error("Cita no encontrada")
    }

    if (appointment.refund_status !== "requested") {
      throw new Error("No hay una solicitud de reembolso para esta cita")
    }

    if (action === "reject") {
      await supabase
        .from("appointments")
        .update({
          refund_status: "rejected",
          refund_resolved_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)

      return new Response(JSON.stringify({ success: true, action: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    // approve → localizar el PaymentIntent (provider_payments o payment_id).
    const { data: paymentRow } = await supabase
      .from("provider_payments")
      .select("id, payment_intent_id, status")
      .eq("appointment_id", appointmentId)
      .maybeSingle()

    const paymentIntentId = paymentRow?.payment_intent_id || appointment.payment_id
    if (!paymentIntentId) {
      throw new Error("No se encontró el pago asociado a esta cita")
    }

    if (paymentRow?.status === "refunded" || appointment.payment_status === "refunded") {
      throw new Error("Este pago ya fue reembolsado")
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      // Devuelve al cliente el dinero transferido al proveedor y la comisión
      // de la plataforma cuando corresponda.
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: {
        appointment_id: appointmentId,
        requested_reason: typeof reason === "string" ? reason.slice(0, 200) : "",
      },
    })

    const now = new Date().toISOString()

    if (paymentRow) {
      await supabase
        .from("provider_payments")
        .update({ status: "refunded", refund_id: refund.id, refunded_at: now })
        .eq("id", paymentRow.id)
    }

    await supabase
      .from("appointments")
      .update({
        payment_status: "refunded",
        refund_status: "approved",
        refund_resolved_at: now,
      })
      .eq("id", appointmentId)

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refund.id,
        status: refund.status,
        payment_intent_id: paymentIntentId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    )
  } catch (error) {
    console.error("❌ Error en process-refund:", error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
