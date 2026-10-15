import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      throw new Error("Provider not found")
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("provider_payments")
      .select(
        "id, payment_intent_id, transfer_id, amount, platform_fee, status, created_at, appointment_id",
      )
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false })
      .limit(300)

    if (paymentsError) {
      throw new Error(paymentsError.message)
    }

    const appointmentIds = (payments || [])
      .map((p) => p.appointment_id)
      .filter((id): id is string => Boolean(id))

    const appointmentsMap = new Map<
      string,
      { id: string; service_name: string | null; client_name: string | null }
    >()
    if (appointmentIds.length > 0) {
      const { data: appointments, error: aptError } = await supabase
        .from("appointments")
        .select("id, service_name, client_name")
        .in("id", appointmentIds)

      if (!aptError && appointments) {
        appointments.forEach((apt) => appointmentsMap.set(apt.id, apt))
      }
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    weekAgo.setHours(0, 0, 0, 0)

    const completed = (payments || []).filter((p) => p.status === "completed")
    const totalEarnings = completed.reduce((s, p) => s + parseFloat(String(p.amount)), 0)
    const monthlyEarnings = completed
      .filter((p) => new Date(p.created_at) >= startOfMonth)
      .reduce((s, p) => s + parseFloat(String(p.amount)), 0)
    const weeklyEarnings = completed
      .filter((p) => new Date(p.created_at) >= weekAgo)
      .reduce((s, p) => s + parseFloat(String(p.amount)), 0)

    const totalCommissions = completed.reduce((s, p) => s + parseFloat(String(p.platform_fee)), 0)
    const averagePayment = completed.length > 0 ? totalEarnings / completed.length : 0

    const uniqueAppointments = new Set(completed.map((p) => p.appointment_id).filter(Boolean))
    const totalClients = uniqueAppointments.size

    const uiPayments = (payments || []).map((payment) => {
      const appointment = payment.appointment_id
        ? appointmentsMap.get(payment.appointment_id)
        : undefined
      const amt = parseFloat(String(payment.amount))
      const fee = parseFloat(String(payment.platform_fee))
      const created = new Date(payment.created_at)
      const uiStatus =
        payment.status === "completed"
          ? "completed"
          : payment.status === "pending_transfer"
            ? "pending"
            : "pending"

      return {
        id: payment.id,
        clientName: appointment?.client_name || "Cliente",
        service: appointment?.service_name || "Servicio",
        amount: amt,
        commission: fee,
        netAmount: Math.round((amt - fee) * 100) / 100,
        paymentMethod: "Tarjeta online",
        date: created.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        time: created.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: uiStatus,
        transactionId: String(payment.transfer_id || payment.payment_intent_id || payment.id),
        created_at: payment.created_at,
      }
    })

    return new Response(
      JSON.stringify({
        stats: {
          totalEarnings,
          monthlyEarnings,
          weeklyEarnings,
          totalCommissions,
          averagePayment,
          totalClients,
        },
        payments: uiPayments,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("get-provider-payments:", error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
