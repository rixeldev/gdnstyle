/**
 * Test records for the venue directory. These stand in for the real database
 * rows (places, names and establishments) until the backend is connected.
 * Cities and areas are proper nouns and stay the same in both locales.
 * `lat`/`lon` are approximate marker coordinates inside each neighborhood
 * (used by the map, directions links and structured data).
 * `image`/`gallery` are test photos under `public/venues` (cover first).
 */
export interface Venue {
  id: string
  name: string
  categoryId: string
  city: string
  area: string
  rating: number
  reviews: number
  /** Starting price in DOP. */
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
}

export const VENUES: Venue[] = [
  {
    id: "salon-aurora",
    name: "Salón Aurora",
    categoryId: "barberia",
    city: "Santo Domingo",
    area: "Piantini",
    rating: 4.8,
    reviews: 214,
    priceFrom: 900,
    services: ["corteYBarba", "corte", "afeitado"],
    image: "/venues/salon-aurora-1.jpg",
    gallery: [
      "/venues/salon-aurora-1.jpg",
      "/venues/salon-aurora-2.jpg",
      "/venues/salon-aurora-3.jpg",
    ],
    lat: 18.4766,
    lon: -69.9278,
    featured: true,
    ownerId: "demo-professional",
    description:
      "Barbería de barrio con aires modernos: cortes clásicos, fades y arreglo de barba con toalla caliente.",
    phone: "+1 809 555 0142",
    whatsapp: "+1 809 555 0142",
    instagram: "@salonaurora",
  },
  {
    id: "estudio-lulu",
    name: "Estudio Lulú",
    categoryId: "cejasPestanas",
    city: "Santo Domingo",
    area: "Naco",
    rating: 4.9,
    reviews: 167,
    priceFrom: 750,
    services: ["cejas", "pestanas", "laminado"],
    image: "/venues/estudio-lulu-1.jpg",
    gallery: [
      "/venues/estudio-lulu-1.jpg",
      "/venues/estudio-lulu-2.jpg",
      "/venues/estudio-lulu-3.jpg",
    ],
    lat: 18.4659,
    lon: -69.9224,
    featured: true,
  },
  {
    id: "skin-lab-rd",
    name: "Skin Lab RD",
    categoryId: "cuidadoPiel",
    city: "Santo Domingo",
    area: "Evaristo Morales",
    rating: 4.7,
    reviews: 98,
    priceFrom: 1800,
    services: ["limpiezaFacial", "facial", "peeling"],
    image: "/venues/skin-lab-rd-1.jpg",
    gallery: [
      "/venues/skin-lab-rd-1.jpg",
      "/venues/skin-lab-rd-2.jpg",
      "/venues/skin-lab-rd-3.jpg",
    ],
    lat: 18.4552,
    lon: -69.951,
  },
  {
    id: "cera-co",
    name: "Cera & Co.",
    categoryId: "depilacion",
    city: "Santo Domingo",
    area: "Bella Vista",
    rating: 4.6,
    reviews: 76,
    priceFrom: 600,
    services: ["cera", "laser"],
    image: "/venues/cera-co-1.jpg",
    gallery: ["/venues/cera-co-1.jpg", "/venues/cera-co-2.jpg", "/venues/cera-co-3.jpg"],
    lat: 18.4486,
    lon: -69.9375,
  },
  {
    id: "muse-makeup",
    name: "Muse Makeup",
    categoryId: "maquillaje",
    city: "Santo Domingo",
    area: "Zona Colonial",
    rating: 4.9,
    reviews: 141,
    priceFrom: 2500,
    services: ["maquillajeNovia", "maquillajeSocial"],
    image: "/venues/muse-makeup-1.jpg",
    gallery: [
      "/venues/muse-makeup-1.jpg",
      "/venues/muse-makeup-2.jpg",
      "/venues/muse-makeup-3.jpg",
    ],
    lat: 18.4738,
    lon: -69.8844,
    featured: true,
    ownerId: "demo-professional",
    description:
      "Estudio de maquillaje para novias, sesiones y eventos. Prueba previa y acompañamiento el día de la boda.",
    phone: "+1 809 555 0198",
    whatsapp: "+1 809 555 0198",
    instagram: "@musemakeup",
  },
  {
    id: "templo-masaje",
    name: "Templo Masaje",
    categoryId: "masaje",
    city: "Santo Domingo",
    area: "Gazcue",
    rating: 4.8,
    reviews: 112,
    priceFrom: 1500,
    services: ["masajeRelajante", "descontracturante", "piedras"],
    image: "/venues/templo-masaje-1.jpg",
    gallery: [
      "/venues/templo-masaje-1.jpg",
      "/venues/templo-masaje-2.jpg",
      "/venues/templo-masaje-3.jpg",
    ],
    lat: 18.4654,
    lon: -69.9013,
  },
  {
    id: "barberia-el-capitan",
    name: "Barbería El Capitán",
    categoryId: "barberia",
    city: "Santiago",
    area: "Los Jardines",
    rating: 4.7,
    reviews: 183,
    priceFrom: 700,
    services: ["corte", "afeitado", "corteYBarba"],
    image: "/venues/barberia-el-capitan-1.jpg",
    gallery: [
      "/venues/barberia-el-capitan-1.jpg",
      "/venues/barberia-el-capitan-2.jpg",
      "/venues/barberia-el-capitan-3.jpg",
    ],
    lat: 19.4703,
    lon: -70.6729,
  },
  {
    id: "glow-studio",
    name: "Glow Studio",
    categoryId: "cuidadoPiel",
    city: "Santiago",
    area: "Cerros de Gurabo",
    rating: 4.5,
    reviews: 54,
    priceFrom: 1600,
    services: ["facial", "peeling"],
    image: "/venues/glow-studio-1.jpg",
    gallery: [
      "/venues/glow-studio-1.jpg",
      "/venues/glow-studio-2.jpg",
      "/venues/glow-studio-3.jpg",
    ],
    lat: 19.4306,
    lon: -70.706,
  },
  {
    id: "lumiere-brows",
    name: "Lumière Brows",
    categoryId: "cejasPestanas",
    city: "Punta Cana",
    area: "Bávaro",
    rating: 5,
    reviews: 89,
    priceFrom: 850,
    services: ["cejas", "pestanas"],
    image: "/venues/lumiere-brows-1.jpg",
    gallery: [
      "/venues/lumiere-brows-1.jpg",
      "/venues/lumiere-brows-2.jpg",
      "/venues/lumiere-brows-3.jpg",
    ],
    lat: 18.6571,
    lon: -68.4473,
    featured: true,
  },
  {
    id: "palma-real-spa",
    name: "Palma Real Spa",
    categoryId: "masaje",
    city: "La Romana",
    area: "Casa de Campo",
    rating: 4.9,
    reviews: 67,
    priceFrom: 2200,
    services: ["masajeRelajante", "piedras"],
    image: "/venues/palma-real-spa-1.jpg",
    gallery: [
      "/venues/palma-real-spa-1.jpg",
      "/venues/palma-real-spa-2.jpg",
      "/venues/palma-real-spa-3.jpg",
    ],
    lat: 18.4205,
    lon: -68.9614,
  },
]

export const VENUE_CITIES = Array.from(new Set(VENUES.map((venue) => venue.city)))

export const VENUE_ZONES = Array.from(new Map(VENUES.map((venue) => [venue.area, venue])).values())
  .map((venue) => ({ area: venue.area, city: venue.city }))
  .sort((a, b) => a.area.localeCompare(b.area))
