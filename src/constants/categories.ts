import type { Category } from "@/interfaces/common"

/**
 * Marketing categories shown on the landing page. `id` is the canonical key and
 * matches `Venue["categoryId"]` (camelCase); `slug` is only used for the SEO
 * pages under `/locales/categoria/[slug]`.
 */
export const CATEGORIES: Category[] = [
  { id: "barberia", slug: "barberia", labelKey: "categories.barberia", icon: "scissors" },
  {
    id: "cejasPestanas",
    slug: "cejas-y-pestanas",
    labelKey: "categories.cejasPestanas",
    icon: "eye",
  },
  {
    id: "cuidadoPiel",
    slug: "cuidado-de-la-piel",
    labelKey: "categories.cuidadoPiel",
    icon: "sparkles",
  },
  { id: "depilacion", slug: "depilacion", labelKey: "categories.depilacion", icon: "droplet" },
  { id: "maquillaje", slug: "maquillaje", labelKey: "categories.maquillaje", icon: "brush" },
  { id: "masaje", slug: "masaje", labelKey: "categories.masaje", icon: "flower" },
]

/**
 * Remaining `business_categories` rows from the live database. Kept separate so
 * the landing page keeps its curated six while the marketplace filter and the
 * venue adapter can resolve every stored category.
 */
const DATABASE_CATEGORIES: Category[] = [
  { id: "peluqueria", slug: "peluqueria", labelKey: "categories.peluqueria", icon: "scissors" },
  {
    id: "daySpa",
    slug: "bienestar-y-day-spa",
    labelKey: "categories.daySpa",
    icon: "flower",
  },
  {
    id: "medicinaEstetica",
    slug: "medicina-estetica",
    labelKey: "categories.medicinaEstetica",
    icon: "sparkles",
  },
  { id: "piercing", slug: "piercing", labelKey: "categories.piercing", icon: "star" },
  { id: "salonUnas", slug: "salon-de-unas", labelKey: "categories.salonUnas", icon: "brush" },
  {
    id: "saludDental",
    slug: "salud-dental-y-ortodoncia",
    labelKey: "categories.saludDental",
    icon: "shield",
  },
  {
    id: "saludFitness",
    slug: "salud-y-fitness",
    labelKey: "categories.saludFitness",
    icon: "heart",
  },
  {
    id: "serviciosDomicilio",
    slug: "servicios-a-domicilio",
    labelKey: "categories.serviciosDomicilio",
    icon: "navigation",
  },
  {
    id: "serviciosMascotas",
    slug: "servicios-para-mascotas",
    labelKey: "categories.serviciosMascotas",
    icon: "heart",
  },
  {
    id: "serviciosProfesionales",
    slug: "servicios-profesionales",
    labelKey: "categories.serviciosProfesionales",
    icon: "badge-check",
  },
  { id: "tatuadores", slug: "tatuadores", labelKey: "categories.tatuadores", icon: "brush" },
  {
    id: "trenzasRastas",
    slug: "trenzas-y-rastas",
    labelKey: "categories.trenzasRastas",
    icon: "scissors",
  },
]

/** Every known category: curated marketing set first, database rows after. */
export const ALL_CATEGORIES: Category[] = [...CATEGORIES, ...DATABASE_CATEGORIES]

export function getCategoryBySlug(slug: string): Category | undefined {
  return ALL_CATEGORIES.find((category) => category.slug === slug)
}

export function getCategoryById(id: string): Category | undefined {
  return ALL_CATEGORIES.find((category) => category.id === id)
}
