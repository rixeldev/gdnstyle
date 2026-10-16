import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

/**
 * Day-before appointment reminders, driven by pg_cron (migration 0009).
 *
 * Called once a day by the scheduler, it emails every client whose appointment
 * falls on tomorrow and has not been reminded yet, then stamps
 * `reminder_sent_at`. That stamp is what makes the endpoint safe to expose to
 * the scheduler without a secret: a second call in the same window finds
 * nothing to do, so nobody can use it to mail the same person twice, and the
 * only recipients are people who really booked.
 *
 * `REMINDER_CRON_SECRET`, when set, additionally requires a matching
 * `x-cron-secret` header, for operators who would rather the endpoint were
 * unreachable from outside their own project.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

/**
 * The platform stores `scheduled_date` as the venue's local calendar day, so
 * "tomorrow" has to be read in a US timezone rather than in UTC: at 02:00 UTC
 * it is still yesterday in Miami, and a UTC-based window would remind half a
 * day late. A per-provider timezone belongs here once the schema grows one.
 */
const TIME_ZONE = "America/New_York"

/** `YYYY-MM-DD` of the calendar day `offsetDays` from now, in the platform zone. */
function dateKeyInZone(instant: Date, offsetDays: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant)

  const [year, month, day] = parts.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10)
}

/** `HH:MM` (24h, as stored) → `9:30 AM` for the email body. */
function formatTime(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return hhmm
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)))
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get("REMINDER_CRON_SECRET")
    if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY")
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "GDN Style <no-reply@gdnstyle.com>"
    if (!resendApiKey) {
      throw new Error("Falta RESEND_API_KEY en variables de entorno.")
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const tomorrow = dateKeyInZone(new Date(), 1)

    // Only what the email needs. `reminder_sent_at` is the idempotency stamp:
    // rows already reminded are invisible to the next run, so a re-triggered
    // job can never mail the same person twice.
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, client_name, client_email, service_name, scheduled_date, scheduled_time")
      .eq("scheduled_date", tomorrow)
      .in("status", ["pending", "confirmed"])
      .is("reminder_sent_at", null)
      .not("client_email", "is", null)
      .limit(500)

    if (error) {
      throw new Error(`No se pudieron leer las citas de mañana: ${error.message}`)
    }

    const rows = appointments ?? []
    const dayLong = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(`${tomorrow}T12:00:00Z`))

    const dashboardUrl = Deno.env.get("APP_URL")
      ? `${Deno.env.get("APP_URL")}/dashboard`
      : null

    let sent = 0
    let failed = 0

    for (const row of rows) {
      const time = formatTime(row.scheduled_time)
      const service = row.service_name || "your appointment"
      const subject = `Reminder: ${service} tomorrow at ${time}`

      const lines = [
        `Hi ${row.client_name || "there"},`,
        "",
        `This is a reminder that your appointment — ${service} — is tomorrow,`,
        `${dayLong}, at ${time}.`,
        "",
        "You can reschedule or cancel up to 1 h 30 min before it starts.",
        ...(dashboardUrl ? ["", `Manage it here: ${dashboardUrl}`] : []),
      ]

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [row.client_email],
          subject,
          text: lines.join("\n"),
        }),
      })

      if (!response.ok) {
        failed += 1
        console.error(`Recordatorio fallido para ${row.id}:`, await response.text())
        continue
      }

      // Stamp only what actually went out: a failed send stays eligible for
      // the next run instead of silently losing its reminder.
      const { error: stampError } = await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", row.id)

      if (stampError) {
        failed += 1
        console.error(`No se pudo marcar el recordatorio de ${row.id}:`, stampError.message)
        continue
      }

      sent += 1
    }

    console.log(`Recordatorios de ${tomorrow}: ${sent} enviados, ${failed} fallidos`)

    return new Response(
      JSON.stringify({ success: true, date: tomorrow, total: rows.length, sent, failed }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("❌ Error en send-appointment-reminders:", error)
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    )
  }
})
