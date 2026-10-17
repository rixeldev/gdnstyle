/**
 * The zones a professional may pick for their schedule. The whole current
 * catalog sits in the New York metro, but the platform speaks to the whole
 * US market, so the six continental zones plus Alaska, Hawaii and Arizona
 * (which does not follow daylight saving) cover it without shipping a list of
 * four hundred entries into the select.
 */
export const US_TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Phoenix",
] as const

/** The zone assumed for professionals who have not picked one. */
export const DEFAULT_TIME_ZONE = "America/New_York"
