import { serviceDurationMin, servicePrice } from "@/constants/services"
import type { Venue } from "@/constants/venues"

/**
 * A selectable service, regardless of whether it comes from the static test
 * catalog (`Venue.services`, translated via i18n) or the live
 * `provider_services` table (a raw database label).
 */
export interface VenueServiceOption {
  id: string
  /** i18n key for static services. */
  labelKey?: string
  /** Raw label for database services. */
  label?: string
  price: number
  durationMin: number
  /** Provider offering the service (database services only). */
  professionalId?: string
}

/** Bookable services for a venue: database rows when present, else the test catalog. */
export function venueServiceOptions(venue: Venue): VenueServiceOption[] {
  if (venue.serviceList && venue.serviceList.length > 0) {
    return venue.serviceList.map((service) => ({
      id: service.id,
      label: service.name,
      price: service.price,
      durationMin: service.durationMin,
      professionalId: service.providerId,
    }))
  }

  return venue.services.map((id) => ({
    id,
    labelKey: `venues.services.${id}`,
    price: servicePrice(venue, id),
    durationMin: serviceDurationMin(id),
  }))
}
