import type { Category } from "@/interfaces/common"

/**
 * Service categories. `id` is the canonical key and matches
 * `Venue["categoryId"]` (camelCase); `slug` is only used for the SEO pages
 * under `/locales/categoria/[slug]`.
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

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug)
}

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id)
}
