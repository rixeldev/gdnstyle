import { timeslotEpoch } from "@/utils/date"

/**
 * The only states the app speaks: pending, confirmed, overdue and the terminal
 * cancelled. `overdue` is never stored — it is derived from the clock, so a
 * pending appointment whose own duration has already elapsed simply reads as
 * atrasada on both dashboards without any write or cron job.
 */
export type AppointmentDisplayStatus = "pending" | "confirmed" | "overdue" | "cancelled"

/** A pending appointment counts as over once its own duration has elapsed. */
const DEFAULT_DURATION_MIN = 30

interface StatusInput {
  /** Stored `appointments.status` (`completed` is a legacy alias of confirmed). */
  status?: string | null
  /** `YYYY-MM-DD`. */
  date: string
  /** `HH:MM`. */
  time: string
  durationMinutes?: number | null
  /**
   * The provider's IANA zone (`providers.timezone`), which the stored wall
   * clock is written in. Without it the browser's own zone is used — the
   * fallback for local demo records and for rows fetched before migration
   * 0013 existed.
   */
  timeZone?: string | null
}

/**
 * Resolve the status shown in the UI for one appointment.
 *
 * - `cancelled` always wins (it is terminal).
 * - `confirmed` stays confirmed even after the hour passes: the professional
 *   vouched for it, so it reads as attended rather than missed.
 * - `completed` is a legacy value written by older rows and maps to confirmed.
 * - Anything else is pending, and becomes `overdue` once the appointment is
 *   over (start time + its duration).
 */
export function appointmentDisplayStatus(
  booking: StatusInput,
  nowMs: number,
): AppointmentDisplayStatus {
  const stored = (booking.status ?? "pending").toLowerCase()

  if (stored === "cancelled") return "cancelled"
  if (stored === "confirmed" || stored === "completed") return "confirmed"

  const endsAt =
    timeslotEpoch(booking.date, booking.time, booking.timeZone) +
    Math.max(1, booking.durationMinutes ?? DEFAULT_DURATION_MIN) * 60_000

  return nowMs > endsAt ? "overdue" : "pending"
}

/** Minutes left until an appointment starts (0 once it has started). */
export function minutesUntilStart(booking: StatusInput, nowMs: number): number {
  const remaining = timeslotEpoch(booking.date, booking.time, booking.timeZone) - nowMs
  return remaining > 0 ? Math.ceil(remaining / 60_000) : 0
}

/**
 * How long before its own start the client may still act on a booking:
 * editing and cancelling are both closed inside this window.
 */
export const CLIENT_CHANGE_WINDOW_MIN = 90

/**
 * `true` while the client may still edit or cancel the appointment.
 *
 * Anything closer than `CLIENT_CHANGE_WINDOW_MIN` (1h30m) — including an
 * appointment that already started — locks both actions. The professional is
 * not bound by this: they can still confirm or cancel on their side.
 */
export function canClientModify(booking: StatusInput, nowMs: number): boolean {
  return minutesUntilStart(booking, nowMs) >= CLIENT_CHANGE_WINDOW_MIN
}

/**
 * Whether a booking belongs to the history list instead of the active one.
 *
 * Overdue stays active on purpose: nobody confirmed it, so both the client and
 * the professional still have to deal with it. History therefore holds only
 * cancelled rows plus confirmed ones whose hour already passed.
 */
export function isHistoryBooking(
  status: AppointmentDisplayStatus,
  date: string,
  time: string,
  nowMs: number,
  timeZone?: string | null,
): boolean {
  return (
    status === "cancelled" ||
    (status === "confirmed" && timeslotEpoch(date, time, timeZone) < nowMs)
  )
}
