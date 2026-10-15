import type { Venue } from "@/constants/venues"

/**
 * Duration and price offset per service id (labels live in `venues.services.*`).
 * Each venue's starting price (`priceFrom`) is the base: a service costs
 * `priceFrom + surcharge`, which keeps the "From $X" claim honest because
 * every venue offers at least one service with a zero surcharge.
 */
export interface ServiceInfo {
  /** Estimated duration in minutes. */
  durationMin: number
  /** Extra cost in USD on top of the venue base price. */
  surcharge: number
}

export const SERVICE_CATALOG: Record<string, ServiceInfo> = {
  corte: { durationMin: 30, surcharge: 0 },
  corteYBarba: { durationMin: 45, surcharge: 10 },
  afeitado: { durationMin: 20, surcharge: 0 },
  cejas: { durationMin: 25, surcharge: 0 },
  pestanas: { durationMin: 90, surcharge: 35 },
  laminado: { durationMin: 40, surcharge: 15 },
  facial: { durationMin: 45, surcharge: 0 },
  limpiezaFacial: { durationMin: 50, surcharge: 20 },
  peeling: { durationMin: 60, surcharge: 25 },
  cera: { durationMin: 30, surcharge: 0 },
  laser: { durationMin: 60, surcharge: 30 },
  maquillajeSocial: { durationMin: 60, surcharge: 0 },
  maquillajeNovia: { durationMin: 120, surcharge: 50 },
  masajeRelajante: { durationMin: 50, surcharge: 0 },
  descontracturante: { durationMin: 60, surcharge: 15 },
  piedras: { durationMin: 75, surcharge: 25 },
}

export function serviceDurationMin(serviceId: string): number {
  return SERVICE_CATALOG[serviceId]?.durationMin ?? 45
}

export function servicePrice(venue: Venue, serviceId: string): number {
  return venue.priceFrom + (SERVICE_CATALOG[serviceId]?.surcharge ?? 0)
}
