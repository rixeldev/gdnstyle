import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchOccupiedSlots, slotIsFree, type OccupiedSlot } from "@/services/appointments.service"
import { parseDateKey, timeslotEpoch } from "@/utils/date"

/**
 * Availability rules, in one place shared by the booking grid, the pre-payment
 * re-check and the insert guard:
 *
 * 1. A day is a sequence of candidate start times whose step is the *service's
 *    own duration* (a 20-minute service offers 9:00, 9:20, 9:40…), so two
 *    bookings never leave an unusable sliver between them.
 * 2. Candidates only exist inside the professional's working window
 *    (`provider_schedule.start_time` → `end_time`), never across the lunch
 *    break, and the whole service must fit before the day ends.
 * 3. A candidate is dropped when it collides with an existing appointment,
 *    which occupies its own `duration_minutes` (a 9:00 booking lasting 45 min
 *    hides 9:30 even though that exact minute has no row of its own).
 * 4. Past hours are dropped.
 *
 * When a professional has no `provider_schedule` row for that weekday the
 * fallback window (9:00–18:15) applies, and `is_day_off` empties the day.
 */

/** Fallback working window, in minutes since midnight. */
const DEFAULT_START_MIN = 9 * 60
const DEFAULT_END_MIN = 18 * 60 + 15

/** One `provider_schedule` row, already normalised to `HH:MM`. */
export interface ProviderScheduleRow {
  /** `EXTRACT(DOW)`: 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number
  start: string | null
  end: string | null
  lunchStart: string | null
  lunchEnd: string | null
  isDayOff: boolean
}

/** Stable empty list so derived values keep the same reference. */
export const NO_SCHEDULE: ProviderScheduleRow[] = []

/** `HH:MM` or `HH:MM:SS` → minutes since midnight (null when unusable). */
function toMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

/** Minutes since midnight → the `HH:MM` string used across the booking UI. */
export function toHhMm(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0")
  const mins = String(minutes % 60).padStart(2, "0")
  return `${hours}:${mins}`
}

/**
 * The professional's working hours, one row per weekday. RLS grants every
 * user the "Clients can view provider schedules" policy, so this read is safe
 * from the browser.
 */
export async function fetchProviderSchedule(
  client: SupabaseClient,
  providerId: string,
): Promise<ProviderScheduleRow[]> {
  const { data, error } = await client
    .from("provider_schedule")
    .select("day_of_week,start_time,end_time,lunch_start,lunch_end,is_day_off")
    .eq("provider_id", providerId)

  if (error) {
    console.error("[provider_schedule] failed to load the working hours", error)
    return []
  }

  return (data ?? []).map((row) => ({
    dayOfWeek: Number(row.day_of_week),
    start: row.start_time ? String(row.start_time).slice(0, 5) : null,
    end: row.end_time ? String(row.end_time).slice(0, 5) : null,
    lunchStart: row.lunch_start ? String(row.lunch_start).slice(0, 5) : null,
    lunchEnd: row.lunch_end ? String(row.lunch_end).slice(0, 5) : null,
    isDayOff: Boolean(row.is_day_off),
  }))
}

export interface DaySlotsInput {
  /** `YYYY-MM-DD`. */
  dateKey: string
  /** Duration of the service being booked, in minutes (30 when unknown). */
  durationMinutes: number
  /** Intervals already booked for that provider on that day. */
  occupied: OccupiedSlot[]
  /** The provider's `provider_schedule` rows (empty for demo venues). */
  schedule: ProviderScheduleRow[]
  /** Demo venues keep a deterministic ~20% of slots taken. */
  demo?: boolean
}

/**
 * Every bookable start time of a day, in order. Only slots the visitor may
 * actually pick are returned: taken, blocked, out-of-hours and past hours are
 * simply absent, so the grid never offers an hour that would be refused.
 */
export function buildDaySlots(input: DaySlotsInput): string[] {
  const { dateKey, durationMinutes, occupied, schedule, demo = false } = input
  const duration = Math.max(1, durationMinutes || 30)
  const day = parseDateKey(dateKey)
  // `Date.getDay()` is already 0 = Sunday, matching `day_of_week`.
  const row = schedule.find((item) => item.dayOfWeek === day.getDay())
  if (row?.isDayOff) return []

  const startMin = row ? (toMinutes(row.start) ?? DEFAULT_START_MIN) : DEFAULT_START_MIN
  const endMin = row ? (toMinutes(row.end) ?? DEFAULT_END_MIN) : DEFAULT_END_MIN
  const lunchStartMin = row ? toMinutes(row.lunchStart) : null
  const lunchEndMin = row ? toMinutes(row.lunchEnd) : null

  const now = Date.now()
  // Deterministic test seed for demo venues (same rule as before).
  const seed = Math.floor(
    new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() / 86_400_000,
  )
  const slots: string[] = []

  for (
    let minutes = startMin, index = 0;
    minutes + duration <= endMin;
    minutes += duration, index += 1
  ) {
    // The service must never straddle the lunch break.
    if (
      lunchStartMin !== null &&
      lunchEndMin !== null &&
      minutes < lunchEndMin &&
      lunchStartMin < minutes + duration
    ) {
      continue
    }

    // Demo venues (no appointments table behind them) keep the old
    // deterministic test availability so the flow stays demonstrable.
    if (demo && (seed + index * 7) % 5 === 0) continue

    const time = toHhMm(minutes)
    // Another appointment occupies its whole duration, so a 9:00 booking of
    // 45 min removes 9:30 too even without a row of its own.
    if (!slotIsFree(occupied, time, duration)) continue
    if (timeslotEpoch(dateKey, time) <= now) continue

    slots.push(time)
  }

  return slots
}

export interface SlotCheckInput {
  providerId: string
  locationId: string
  /** `YYYY-MM-DD`. */
  dateKey: string
  /** `HH:MM`. */
  time: string
  durationMinutes: number
}

/**
 * Authoritative re-check used right before charging a card or inserting a
 * row: loads the day's occupancy and the working hours, then reports whether
 * that exact hour is still bookable. Both payment paths run it so a slot that
 * filled up while the form was open is refused instead of double booked.
 */
export async function isSlotAvailable(
  client: SupabaseClient,
  input: SlotCheckInput,
): Promise<boolean> {
  const [occupied, schedule] = await Promise.all([
    fetchOccupiedSlots(client, {
      locationId: input.locationId,
      providerId: input.providerId,
      date: input.dateKey,
    }),
    fetchProviderSchedule(client, input.providerId),
  ])

  return buildDaySlots({
    dateKey: input.dateKey,
    durationMinutes: input.durationMinutes,
    occupied,
    schedule,
  }).includes(input.time)
}
