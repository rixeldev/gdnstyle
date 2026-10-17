import { US_TIME_ZONES } from "@/constants/timezones"

/**
 * Label for one IANA zone in the account select: `(UTC-04:00) America/New_York`.
 * The offset is computed at render time, so it already reflects daylight
 * saving for the date it is shown on, and the identifier stays visible —
 * that is the value the professional recognises and the database stores.
 */
export function timeZoneLabel(id: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: id,
    timeZoneName: "longOffset",
  }).formatToParts(at)

  const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "UTC"
  return `${offset.replace("GMT", "UTC")} · ${id}`
}

/** Options for the timezone `<select>` in the professional's account. */
export function timeZoneOptions(at: Date = new Date()): Array<{ value: string; label: string }> {
  return US_TIME_ZONES.map((id) => ({ value: id, label: timeZoneLabel(id, at) }))
}
