/**
 * Test records for the venue directory. These stand in for the real database
 * rows (places, names and establishments) until the backend is connected.
 * Cities and areas are proper nouns and stay the same in both locales.
 * `lat`/`lon` are approximate marker coordinates inside each neighborhood
 * (used by the map, directions links and structured data).
 * `image`/`gallery` are test photos under `public/venues` (cover first).
 */
/** A professional (`providers` row) attached to a location. */
export interface VenueProfessional {
  id: string
  name: string
  photo?: string
  rating: number
  reviews: number
  /** Raw category names the professional works with (database records). */
  specialties?: string[]
  /** i18n key under `venues.professionals.specialties.*` (static records). */
  specialtyKey?: string
  /** Years of experience (static records only). */
  experience?: number
}

/** A bookable service (`provider_services` row) offered at a location. */
export interface VenueServiceItem {
  id: string
  providerId: string
  providerName: string
  name: string
  category?: string
  price: number
  durationMin: number
}

/** A customer review (`location_reviews` row). */
export interface VenueReviewItem {
  id: string
  /** Reviewer name when known; the UI falls back to a generic label. */
  author?: string
  rating: number
  text: string
  createdAt?: string
}

export interface Venue {
  id: string
  name: string
  categoryId: string
  city: string
  area: string
  rating: number
  reviews: number
  /** Starting price in USD. */
  priceFrom: number
  /** Keys under `venues.services.*`. */
  services: string[]
  /** Cover photo path under `public/venues`. */
  image: string
  /** Gallery photo paths under `public/venues` (cover first). */
  gallery: string[]
  lat: number
  lon: number
  featured?: boolean
  /**
   * Professional account that owns the venue. Static records can be claimed by
   * the demo professional; venues created from the professional dashboard store
   * this too (see `@/libs/venue-store`).
   */
  ownerId?: string
  /** Short editable description shown on the venue page. */
  description?: string
  /** Contact details, editable by the owner. */
  phone?: string
  whatsapp?: string
  instagram?: string
  /** When `true` the venue is hidden from the public directory. */
  hidden?: boolean
  /** Every category id when the record lists several (database records). */
  categoryIds?: string[]
  /** Raw category names exactly as stored in the database. */
  categoryNames?: string[]
  /** Street address from the database (static records have none). */
  address?: string
  /** Country name from the database (used by structured data). */
  country?: string
  /** Professionals working at this location (database records). */
  professionals?: VenueProfessional[]
  /** Real services from `provider_services` (database records). */
  serviceList?: VenueServiceItem[]
  /** Real reviews from `location_reviews` (database records). */
  reviewsList?: VenueReviewItem[]
  /** Where the record came from; database records carry no test data. */
  source?: "static" | "database"
  /** Whether `lat`/`lon` are real coordinates (database rows may have none). */
  hasCoords?: boolean
}

export const VENUES: Venue[] = [
  {
    id: "salon-aurora",
    name: "Salón Aurora",
    categoryId: "barberia",
    city: "Manhattan",
    area: "Harlem",
    rating: 4.8,
    reviews: 214,
    priceFrom: 30,
    services: ["corteYBarba", "corte", "afeitado"],
    image: "/venues/salon-aurora-1.jpg",
    gallery: [
      "/venues/salon-aurora-1.jpg",
      "/venues/salon-aurora-2.jpg",
      "/venues/salon-aurora-3.jpg",
    ],
    lat: 40.8116,
    lon: -73.9465,
    featured: true,
    ownerId: "demo-professional",
    description:
      "Neighborhood barbershop with a modern edge: classic cuts, fades and a hot-towel beard trim.",
    phone: "+1 212 555 0142",
    whatsapp: "+1 212 555 0142",
    instagram: "@salonaurora",
  },
  {
    id: "estudio-lulu",
    name: "Estudio Lulú",
    categoryId: "cejasPestanas",
    city: "Brooklyn",
    area: "Williamsburg",
    rating: 4.9,
    reviews: 167,
    priceFrom: 35,
    services: ["cejas", "pestanas", "laminado"],
    image: "/venues/estudio-lulu-1.jpg",
    gallery: [
      "/venues/estudio-lulu-1.jpg",
      "/venues/estudio-lulu-2.jpg",
      "/venues/estudio-lulu-3.jpg",
    ],
    lat: 40.7081,
    lon: -73.9571,
    featured: true,
  },
  {
    id: "skin-lab-nyc",
    name: "Skin Lab NYC",
    categoryId: "cuidadoPiel",
    city: "Queens",
    area: "Astoria",
    rating: 4.7,
    reviews: 98,
    priceFrom: 75,
    services: ["limpiezaFacial", "facial", "peeling"],
    image: "/venues/skin-lab-rd-1.jpg",
    gallery: [
      "/venues/skin-lab-rd-1.jpg",
      "/venues/skin-lab-rd-2.jpg",
      "/venues/skin-lab-rd-3.jpg",
    ],
    lat: 40.7723,
    lon: -73.9301,
  },
  {
    id: "cera-co",
    name: "Cera & Co.",
    categoryId: "depilacion",
    city: "Bronx",
    area: "Mott Haven",
    rating: 4.6,
    reviews: 76,
    priceFrom: 40,
    services: ["cera", "laser"],
    image: "/venues/cera-co-1.jpg",
    gallery: ["/venues/cera-co-1.jpg", "/venues/cera-co-2.jpg", "/venues/cera-co-3.jpg"],
    lat: 40.8091,
    lon: -73.9229,
  },
  {
    id: "muse-makeup",
    name: "Muse Makeup",
    categoryId: "maquillaje",
    city: "Manhattan",
    area: "Upper East Side",
    rating: 4.9,
    reviews: 141,
    priceFrom: 120,
    services: ["maquillajeNovia", "maquillajeSocial"],
    image: "/venues/muse-makeup-1.jpg",
    gallery: [
      "/venues/muse-makeup-1.jpg",
      "/venues/muse-makeup-2.jpg",
      "/venues/muse-makeup-3.jpg",
    ],
    lat: 40.7736,
    lon: -73.9566,
    featured: true,
    ownerId: "demo-professional",
    description:
      "Makeup studio for brides, photo sessions and events. Trial run included, plus day-of touch-ups.",
    phone: "+1 212 555 0198",
    whatsapp: "+1 212 555 0198",
    instagram: "@musemakeup",
  },
  {
    id: "templo-masaje",
    name: "Templo Masaje",
    categoryId: "masaje",
    city: "Brooklyn",
    area: "Park Slope",
    rating: 4.8,
    reviews: 112,
    priceFrom: 90,
    services: ["masajeRelajante", "descontracturante", "piedras"],
    image: "/venues/templo-masaje-1.jpg",
    gallery: [
      "/venues/templo-masaje-1.jpg",
      "/venues/templo-masaje-2.jpg",
      "/venues/templo-masaje-3.jpg",
    ],
    lat: 40.671,
    lon: -73.981,
  },
  {
    id: "barberia-el-capitan",
    name: "Barbería El Capitán",
    categoryId: "barberia",
    city: "Newark",
    area: "Ironbound",
    rating: 4.7,
    reviews: 183,
    priceFrom: 25,
    services: ["corte", "afeitado", "corteYBarba"],
    image: "/venues/barberia-el-capitan-1.jpg",
    gallery: [
      "/venues/barberia-el-capitan-1.jpg",
      "/venues/barberia-el-capitan-2.jpg",
      "/venues/barberia-el-capitan-3.jpg",
    ],
    lat: 40.7357,
    lon: -74.1724,
  },
  {
    id: "glow-studio",
    name: "Glow Studio",
    categoryId: "cuidadoPiel",
    city: "Jersey City",
    area: "Downtown",
    rating: 4.5,
    reviews: 54,
    priceFrom: 70,
    services: ["facial", "peeling"],
    image: "/venues/glow-studio-1.jpg",
    gallery: [
      "/venues/glow-studio-1.jpg",
      "/venues/glow-studio-2.jpg",
      "/venues/glow-studio-3.jpg",
    ],
    lat: 40.7178,
    lon: -74.0431,
  },
  {
    id: "lumiere-brows",
    name: "Lumière Brows",
    categoryId: "cejasPestanas",
    city: "Hoboken",
    area: "Waterfront",
    rating: 5,
    reviews: 89,
    priceFrom: 45,
    services: ["cejas", "pestanas"],
    image: "/venues/lumiere-brows-1.jpg",
    gallery: [
      "/venues/lumiere-brows-1.jpg",
      "/venues/lumiere-brows-2.jpg",
      "/venues/lumiere-brows-3.jpg",
    ],
    lat: 40.7439,
    lon: -74.0324,
    featured: true,
  },
  {
    id: "palma-real-spa",
    name: "Palma Real Spa",
    categoryId: "masaje",
    city: "Paterson",
    area: "Great Falls",
    rating: 4.9,
    reviews: 67,
    priceFrom: 110,
    services: ["masajeRelajante", "piedras"],
    image: "/venues/palma-real-spa-1.jpg",
    gallery: [
      "/venues/palma-real-spa-1.jpg",
      "/venues/palma-real-spa-2.jpg",
      "/venues/palma-real-spa-3.jpg",
    ],
    lat: 40.9168,
    lon: -74.1718,
  },
]

export const VENUE_CITIES = Array.from(new Set(VENUES.map((venue) => venue.city)))

export const VENUE_ZONES = Array.from(new Map(VENUES.map((venue) => [venue.area, venue])).values())
  .map((venue) => ({ area: venue.area, city: venue.city }))
  .sort((a, b) => a.area.localeCompare(b.area))
