import type { SupabaseClient } from "@supabase/supabase-js"

import {
  fetchProviderSchedule,
  toMinutes,
  type ProviderScheduleRow,
} from "@/services/availability.service"

export { fetchProviderSchedule }
export type { ProviderScheduleRow }

/**
 * The schedule the professional edits, in the order the editor lists it.
 * `day_of_week` itself is 0 = Sunday (`EXTRACT(DOW)`), so the mapping is done
 * here rather than in the components.
 */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

/** The window a day falls back to when the professional has no row for it. */
const DEFAULT_START = "09:00"
const DEFAULT_END = "18:15"

/**
 * Every weekday, filling in the days the professional has never saved.
 *
 * A missing row is not the same as a day off: `buildDaySlots` treats "no row"
 * as the default window, so the editor has to show those hours as the current
 * value rather than as an empty field.
 */
export function fillWeek(fetched: ProviderScheduleRow[]): ProviderScheduleRow[] {
  const byDay = new Map(fetched.map((row) => [row.dayOfWeek, row]))
  return DAY_ORDER.map(
    (dayOfWeek) =>
      byDay.get(dayOfWeek) ?? {
        dayOfWeek,
        start: DEFAULT_START,
        end: DEFAULT_END,
        lunchStart: null,
        lunchEnd: null,
        isDayOff: false,
      },
  )
}

/** Translation key of why a day cannot be saved, or `null` when it is fine. */
export function validateDay(row: ProviderScheduleRow): string | null {
  if (row.isDayOff) return null

  const start = toMinutes(row.start)
  const end = toMinutes(row.end)
  if (start === null || end === null) return "schedule.errors.missingHours"
  if (start >= end) return "schedule.errors.endBeforeStart"

  // A half-filled break is a typo, not an intent: either both ends or neither.
  const hasLunch = row.lunchStart !== null || row.lunchEnd !== null
  if (!hasLunch) return null

  const lunchStart = toMinutes(row.lunchStart)
  const lunchEnd = toMinutes(row.lunchEnd)
  if (lunchStart === null || lunchEnd === null) return "schedule.errors.lunchIncomplete"
  if (lunchStart >= lunchEnd) return "schedule.errors.lunchOrder"
  // The booking grid drops any slot that would straddle the break, so a break
  // outside the working window would silently eat hours the professional set.
  if (lunchStart < start || lunchEnd > end) return "schedule.errors.lunchOutside"

  return null
}

/** First invalid day in the week, or `null` when the whole schedule is valid. */
export function validateSchedule(rows: ProviderScheduleRow[]): ProviderScheduleRow | null {
  return rows.find((row) => validateDay(row) !== null) ?? null
}

/** Paid working minutes of one day (the lunch break is subtracted). */
export function dayMinutes(row: ProviderScheduleRow): number {
  if (row.isDayOff) return 0
  const start = toMinutes(row.start)
  const end = toMinutes(row.end)
  if (start === null || end === null || start >= end) return 0

  const lunchStart = toMinutes(row.lunchStart)
  const lunchEnd = toMinutes(row.lunchEnd)
  const break_ =
    lunchStart !== null && lunchEnd !== null && lunchStart < lunchEnd ? lunchEnd - lunchStart : 0

  return end - start - break_
}

/** The professional's whole week, in minutes. */
export function weekMinutes(rows: ProviderScheduleRow[]): number {
  return rows.reduce((total, row) => total + dayMinutes(row), 0)
}

interface SchedulePayload {
  provider_id: string
  day_of_week: number
  start_time: string | null
  end_time: string | null
  lunch_start: string | null
  lunch_end: string | null
  is_day_off: boolean
}

/**
 * Persist the whole week.
 *
 * RLS grants the owner `ALL` on their own rows ("Providers can manage their
 * own schedules"), so this runs straight from the browser. There is no unique
 * constraint on (provider_id, day_of_week) that an upsert could rely on, so the
 * existing rows are read first and each weekday is either inserted or updated.
 * Updates are grouped by identical values, which collapses a typical week to
 * one or two statements.
 */
export async function saveProviderSchedule(
  client: SupabaseClient,
  providerId: string,
  rows: ProviderScheduleRow[],
): Promise<boolean> {
  const { data: existing, error: readError } = await client
    .from("provider_schedule")
    .select("id,day_of_week")
    .eq("provider_id", providerId)

  if (readError) {
    console.error("[provider_schedule] could not read the current schedule", readError)
    return false
  }

  const idByDay = new Map<number, string>()
  for (const row of existing ?? []) idByDay.set(Number(row.day_of_week), String(row.id))

  const inserts: SchedulePayload[] = []
  const updates = new Map<string, { ids: string[]; payload: SchedulePayload }>()

  for (const row of rows) {
    const payload: SchedulePayload = {
      provider_id: providerId,
      day_of_week: row.dayOfWeek,
      start_time: row.start,
      end_time: row.end,
      lunch_start: row.lunchStart,
      lunch_end: row.lunchEnd,
      is_day_off: row.isDayOff,
    }

    const id = idByDay.get(row.dayOfWeek)
    if (!id) {
      inserts.push(payload)
      continue
    }

    // The key ignores the day, so weekdays sharing one window share a statement.
    const { day_of_week: _day, ...values } = payload
    const key = JSON.stringify(values)
    const group = updates.get(key)
    if (group) group.ids.push(id)
    else updates.set(key, { ids: [id], payload })
  }

  if (inserts.length > 0) {
    const { error } = await client.from("provider_schedule").insert(inserts)
    if (error) {
      console.error("[provider_schedule] could not create the working days", error)
      return false
    }
  }

  for (const { ids, payload } of updates.values()) {
    const { provider_id, day_of_week: _day, ...values } = payload
    const { error } = await client.from("provider_schedule").update(values).in("id", ids)
    if (error) {
      console.error("[provider_schedule] could not update the working days", error)
      return false
    }
  }

  return true
}
