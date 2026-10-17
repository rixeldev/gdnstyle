/** Small date helpers used by the booking flow (all local-time based). */

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

/** First day (midnight) of the month a date belongs to. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** First day of the month `months` away from `date`. */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

/** Number of days in the month a date belongs to. */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/** Monday-based weekday index (0 = Monday … 6 = Sunday). */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

/**
 * Month view as a flat Monday-first grid, always six weeks (42 cells) so the
 * calendar keeps the same height when navigating between 5- and 6-row months.
 * Leading/trailing days are `null`.
 */
export function buildMonthGrid(month: Date): Array<Date | null> {
  const cells: Array<Date | null> = []
  for (let index = 0; index < weekdayIndex(startOfMonth(month)); index += 1) {
    cells.push(null)
  }
  for (let day = 1, total = daysInMonth(month); day <= total; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day))
  }
  while (cells.length < 42) {
    cells.push(null)
  }
  return cells
}

/**
 * Milliseconds for a `YYYY-MM-DD` + `HH:MM` pair (for ordering & expiry).
 *
 * The pair is a naive venue wall-clock time. With `timeZone` it is read as
 * that zone's local time — the same clock the database compares it against
 * (`providers.timezone`, migration 0013); without one it falls back to the
 * browser's zone, which is the right reading for local demo records and for
 * rows fetched before that migration exists.
 */
export function timeslotEpoch(dateKey: string, time: string, timeZone?: string | null): number {
  const [year, month, day] = dateKey.split("-").map(Number)
  const [hours, minutes] = time.split(":").map(Number)

  if (timeZone) {
    const wallClock = Date.UTC(year, month - 1, day, hours, minutes)
    try {
      // Two passes: the first offset guess can land on the wrong side of a DST
      // change, and re-reading the offset at the corrected instant settles it.
      const first = wallClock - zoneOffsetMs(wallClock, timeZone)
      return wallClock - zoneOffsetMs(first, timeZone)
    } catch {
      /* unknown zone: read it as the browser's own clock */
    }
  }

  return new Date(year, month - 1, day, hours, minutes).getTime()
}

/** Offset of `timeZone` at the instant `epochMs`, in milliseconds. */
function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epochMs))

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"))
  return asUtc - Math.floor(epochMs / 1000) * 1000
}

/** Stable integer per UTC day (for deterministic test availability). */
export function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000)
}
