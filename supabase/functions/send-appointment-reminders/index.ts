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
 * `scheduled_date` is the venue's local calendar day in the professional's own
 * zone (`providers.timezone`, migration 0013), so "tomorrow" is resolved per
 * provider rather than in UTC: at 02:00 UTC it is still yesterday in Miami,
 * and a UTC-based window would remind half a day late.
 */
const DEFAULT_TIME_ZONE = "America/New_York"

/** Offset of `timeZone` at `instant`, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant)

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"))
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** `YYYY-MM-DD` of the calendar day `offsetDays` from now, in `timeZone`. */
function dateKeyInZone(instant: Date, offsetDays: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant)

  const [year, month, day] = parts.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10)
}

/** The instant that reads as noon on `dateKey` inside `timeZone`. */
function noonOn(dateKey: string, timeZone: string): Date {
  const noonUtc = Date.parse(`${dateKey}T12:00:00Z`)
  const first = new Date(noonUtc - zoneOffsetMs(new Date(noonUtc), timeZone))
  return new Date(noonUtc - zoneOffsetMs(first, timeZone))
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

    const now = new Date()

    // Only what the email needs. `reminder_sent_at` is the idempotency stamp:
    // rows already reminded are invisible to the next run, so a re-triggered
    // job can never mail the same person twice. The date window is four days
    // wide because "tomorrow" is decided per provider below and no zone on
    // earth puts it outside [today - 1, today + 2] in UTC.
    const dateWindow = [-1, 0, 1, 2].map((offset) => dateKeyInZone(now, offset, "UTC"))

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, provider_id, client_name, client_email, service_name, scheduled_date, scheduled_time")
      .in("scheduled_date", dateWindow)
      .in("status", ["pending", "confirmed"])
      .is("reminder_sent_at", null)
      .not("client_email", "is", null)
      .limit(500)

    if (error) {
      throw new Error(`No se pudieron leer las citas: ${error.message}`)
    }

    const rows = appointments ?? []
    if (rows.length === 0) {
      return new Response(JSON.stringify({ success: true, total: 0, sent: 0, failed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    // One lookup for every professional involved; a row whose zone is missing
    // or unreadable falls back to the platform default.
    const providerIds = [...new Set(rows.map((row) => row.provider_id).filter(Boolean))]
    const { data: providers } = await supabase
      .from("providers")
      .select("id, timezone")
      .in("id", providerIds)

    const zoneByProvider = new Map<string, string>()
    for (const provider of providers ?? []) {
      if (provider.timezone) zoneByProvider.set(provider.id, provider.timezone)
    }

    const dashboardUrl = Deno.env.get("APP_URL")
      ? `${Deno.env.get("APP_URL")}/dashboard`
      : null

    const tomorrowByZone = new Map<string, string>()
    const zoneFor = (providerId: string) => zoneByProvider.get(providerId) ?? DEFAULT_TIME_ZONE
    const tomorrowIn = (timeZone: string) => {
      const cached = tomorrowByZone.get(timeZone)
      if (cached) return cached
      const value = dateKeyInZone(now, 1, timeZone)
      tomorrowByZone.set(timeZone, value)
      return value
    }

    let sent = 0
    let failed = 0

    for (const row of rows) {
      const timeZone = zoneFor(row.provider_id)
      try {
        // Still not tomorrow in this venue's zone: another run will catch it.
        const tomorrow = tomorrowIn(timeZone)
        if (row.scheduled_date !== tomorrow) continue

        const time = formatTime(row.scheduled_time)
        const service = row.service_name || "your appointment"
        const subject = `Reminder: ${service} tomorrow at ${time}`

        const dayLong = new Intl.DateTimeFormat("en-US", {
          timeZone,
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(noonOn(tomorrow, timeZone))

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
      } catch (error) {
        // A single unreadable zone or malformed row must not stop the run.
        failed += 1
        console.error(`Recordatorio fallido para ${row.id}:`, (error as Error).message)
      }
    }

    console.log(`Recordatorios: ${sent} enviados, ${failed} fallidos de ${rows.length} candidatas`)

    return new Response(
      JSON.stringify({ success: true, total: rows.length, sent, failed }),
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
