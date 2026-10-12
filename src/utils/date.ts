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

/** Milliseconds for a `YYYY-MM-DD` + `HH:MM` pair (for ordering & expiry). */
export function timeslotEpoch(dateKey: string, time: string): number {
  const [year, month, day] = dateKey.split("-").map(Number)
  const [hours, minutes] = time.split(":").map(Number)
  return new Date(year, month - 1, day, hours, minutes).getTime()
}

/** Stable integer per UTC day (for deterministic test availability). */
export function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000)
}
