import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { VenueDirectory } from "@/components/venues/venue-directory"
import { VenueShell } from "@/components/venues/venue-shell"
import { ALL_CATEGORIES, getCategoryBySlug } from "@/constants/categories"
import type { Venue } from "@/constants/venues"
import { getServerCatalog } from "@/libs/marketplace/server"
import es from "@/locales/es.json"

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

/**
 * Blocking route: the category comes from `params` and the list is filtered
 * from it, so opt out of instant-navigation validation (it still prerenders via
 * `generateStaticParams`).
 */
export const instant = false

/** Prerender one landing page per known category. */
export function generateStaticParams() {
  return ALL_CATEGORIES.map((category) => ({ slug: category.slug }))
}

/** Server-side labels are always Spanish (the locale is applied on the client). */
function categoryLabel(categoryId: string): string {
  return (es.categories as Record<string, string>)[categoryId] ?? categoryId
}

function venueHasCategory(venue: Venue, categoryId: string): boolean {
  return venue.categoryIds?.includes(categoryId) ?? venue.categoryId === categoryId
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) return { title: "Categoría no encontrada" }

  const venues = await getServerCatalog()
  const count = venues.filter((venue) => venueHasCategory(venue, category.id)).length
  const name = categoryLabel(category.id)

  return {
    title: `${name} cerca de ti`,
    description: `Encuentra locales de ${name.toLowerCase()} en GDN Style y reserva tu cita online. ${
      count === 1 ? "1 local disponible" : `${count} locales disponibles`
    } en República Dominicana y Estados Unidos.`,
    alternates: { canonical: `/venues/category/${slug}` },
    openGraph: {
      title: `${name} · GDN Style`,
      description: `Reserva ${name.toLowerCase()} con los mejores locales, valorados por clientas reales.`,
    },
  }
}

/** SEO landing page for a service category. */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) notFound()

  const venues = await getServerCatalog()

  return (
    <VenueShell>
      <VenueDirectory initialCategory={category.id} initialVenues={venues} />
    </VenueShell>
  )
}
