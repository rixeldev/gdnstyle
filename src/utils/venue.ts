import type { Venue } from "@/constants/venues"

/**
 * Human-readable location for a venue: `Area, City`, collapsing to a single
 * value when both are the same (database records without a street address fall
 * back to the city for both).
 */
export function venueLocationLabel(venue: Venue): string {
  const area = venue.area?.trim()
  const city = venue.city?.trim()
  if (!area) return city ?? ""
  if (!city || area === city) return area
  return `${area}, ${city}`
}
