/**
 * Test records for the venue directory. These stand in for the real database
 * rows (places, names and establishments) until the backend is connected.
 * Cities and areas are proper nouns and stay the same in both locales.
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
  featured?: boolean
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
    featured: true,
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
    featured: true,
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
  },
]
