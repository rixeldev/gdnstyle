import type {
  DbLocation,
  DbLocationReview,
  DbProvider,
  DbProviderLocation,
  DbProviderService,
} from "@/interfaces/marketplace"
import type {
  Venue,
  VenueProfessional,
  VenueReviewItem,
  VenueServiceItem,
} from "@/constants/venues"
import type { CatalogData } from "@/services/marketplace.service"

/**
 * Database `business_categories.category` (Spanish label) → canonical
 * `Category["id"]`. Keep in sync with `@/constants/categories`.
 */
export const CATEGORY_NAME_TO_ID: Record<string, string> = {
  Barbería: "barberia",
  Peluquería: "peluqueria",
  "Cejas y pestañas": "cejasPestanas",
  "Cuidado de la piel": "cuidadoPiel",
  Depilación: "depilacion",
  Maquillaje: "maquillaje",
  Masaje: "masaje",
  "Bienestar y Day Spa": "daySpa",
  "Medicina estética": "medicinaEstetica",
  Piercing: "piercing",
  "Salón de uñas": "salonUnas",
  "Salud dental y ortodoncia": "saludDental",
  "Salud y fitness": "saludFitness",
  "Servicios a domicilio": "serviciosDomicilio",
  "Servicios para mascotas": "serviciosMascotas",
  "Servicios profesionales": "serviciosProfesionales",
  Tatuadores: "tatuadores",
  "Trenzas y rastas": "trenzasRastas",
}

/**
 * The inverse mapping: canonical `Category["id"]` → the Spanish label stored in
 * the database (`locations.category`/`provider_locations.category`). Used when a
 * professional creates or edits a venue.
 */
export const CATEGORY_ID_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_NAME_TO_ID).map(([name, id]) => [id, name]),
)

/** Comma-separated database string → trimmed, non-empty names. */
export function splitCategoryNames(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Map stored category names to canonical ids, preserving order and deduping. */
export function categoryIdsFromNames(names: string[]): string[] {
  const ids = names
    .map((name) => CATEGORY_NAME_TO_ID[name])
    .filter((id): id is string => Boolean(id))
  return Array.from(new Set(ids))
}

function groupBy<T>(items: T[], key: (item: T) => string | null | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const group = key(item)
    if (!group) continue
    const list = map.get(group)
    if (list) {
      list.push(item)
    } else {
      map.set(group, [item])
    }
  }
  return map
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Words that stay lowercase inside a place name (Spanish/Portuguese particles). */
const LOCATION_PARTICLES = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "e",
  "da",
  "das",
  "do",
  "dos",
])

function normalizeLocationWord(word: string): string {
  const lower = word.toLocaleLowerCase()
  if (LOCATION_PARTICLES.has(lower)) return lower
  // Words that already carry an uppercase letter are left as-is ("McAllen").
  if (word !== lower) return word
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1)
}

/**
 * Normalize a stored city. The database mixes "Perth Amboy" with
 * "Perth amboy", which would otherwise split the same city across two landing
 * pages and break the city filter.
 */
export function normalizeCity(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return ""
  return trimmed.split(/\s+/).map(normalizeLocationWord).join(" ")
}

function providerName(provider: DbProvider): string {
  return provider.business_name?.trim() || provider.full_name?.trim() || "Profesional"
}

interface AdaptArgs {
  location: DbLocation
  links: DbProviderLocation[]
  providerById: Map<string, DbProvider>
  servicesByProvider: Map<string, DbProviderService[]>
  reviews: DbLocationReview[]
}

function adaptVenue({
  location,
  links,
  providerById,
  servicesByProvider,
  reviews,
}: AdaptArgs): Venue {
  const categoryNames = splitCategoryNames(location.category)
  const categoryIds = categoryIdsFromNames(categoryNames)

  const providers: DbProvider[] = []
  const professionals: VenueProfessional[] = []
  const serviceList: VenueServiceItem[] = []

  for (const link of links) {
    const provider = providerById.get(link.provider_id)
    if (!provider) continue

    providers.push(provider)
    const name = providerName(provider)
    professionals.push({
      id: provider.id,
      name,
      photo: provider.photo ?? undefined,
      rating: provider.rating ?? 0,
      reviews: provider.reviews ?? 0,
      specialties: splitCategoryNames(link.category),
      // The zone the venue's stored hours are written in: the booking grid
      // decides which hours are already past with this clock, not the
      // visitor's own.
      timeZone: provider.timezone ?? undefined,
    })

    for (const service of servicesByProvider.get(provider.id) ?? []) {
      serviceList.push({
        id: service.id,
        providerId: provider.id,
        providerName: name,
        name: service.name,
        category: service.category ?? undefined,
        price: Number(service.price) || 0,
        durationMin: Number(service.duration) || 30,
      })
    }
  }

  const priceFrom = serviceList.length > 0 ? Math.min(...serviceList.map((item) => item.price)) : 0

  const spotRatings = reviews.map((review) => Number(review.rating)).filter((rating) => rating > 0)
  const providerRatings = providers.filter(
    (provider) => (provider.reviews ?? 0) > 0 && (provider.rating ?? 0) > 0,
  )
  const providerReviewTotal = providerRatings.reduce(
    (sum, provider) => sum + (provider.reviews ?? 0),
    0,
  )
  const rating =
    spotRatings.length > 0
      ? round1(spotRatings.reduce((sum, value) => sum + value, 0) / spotRatings.length)
      : providerReviewTotal > 0
        ? round1(
            providerRatings.reduce(
              (sum, provider) => sum + (provider.rating ?? 0) * (provider.reviews ?? 0),
              0,
            ) / providerReviewTotal,
          )
        : 0
  const reviewCount =
    reviews.length > 0
      ? reviews.length
      : providers.reduce((sum, provider) => sum + (provider.reviews ?? 0), 0)

  const gallery = [location.image_url, location.image_alt].filter((value): value is string =>
    Boolean(value),
  )
  const reviewsList: VenueReviewItem[] = [...reviews]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map((review) => ({
      id: review.id,
      author: review.reviewer_name?.trim() || undefined,
      rating: Number(review.rating) || 0,
      text: review.comment?.trim() ?? "",
      createdAt: review.created_at ?? undefined,
    }))
  const primary = providers[0]
  const hasCoords = location.latitude != null && location.longitude != null

  return {
    id: location.id,
    name: location.name,
    categoryId: categoryIds[0] ?? "",
    categoryIds,
    categoryNames,
    city: normalizeCity(location.city),
    area: location.address?.trim() || location.city?.trim() || "",
    address: location.address ?? undefined,
    state: location.state ?? undefined,
    postalCode: location.postal_code ?? undefined,
    country: location.country ?? undefined,
    rating,
    reviews: reviewCount,
    priceFrom,
    services: [],
    serviceList,
    reviewsList,
    professionals,
    image: location.image_url ?? "",
    gallery,
    lat: location.latitude ?? 0,
    lon: location.longitude ?? 0,
    hasCoords,
    source: "database",
    phone: primary?.phone ?? undefined,
    whatsapp: primary?.social_whatsapp ?? undefined,
    instagram: primary?.social_instagram ?? undefined,
  }
}

/** Adapt every location in a catalog payload into the UI `Venue` shape. */
export function adaptVenues(data: CatalogData): Venue[] {
  const providerById = new Map(data.providers.map((provider) => [provider.id, provider]))
  const servicesByProvider = groupBy(data.services, (service) => service.provider_id)
  const reviewsByLocation = groupBy(data.reviews, (review) => review.location_id)
  const linksByLocation = groupBy(data.providerLocations, (link) => link.location_id)

  return data.locations.map((location) =>
    adaptVenue({
      location,
      links: linksByLocation.get(location.id) ?? [],
      providerById,
      servicesByProvider,
      reviews: reviewsByLocation.get(location.id) ?? [],
    }),
  )
}
