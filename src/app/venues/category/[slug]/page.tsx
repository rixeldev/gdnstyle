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
  if (!category) return { title: "Category not found" }

  const venues = await getServerCatalog()
  const count = venues.filter((venue) => venueHasCategory(venue, category.id)).length
  const name = categoryLabel(category.id)

  return {
    title: `${name} near you`,
    description: `Find ${name.toLowerCase()} venues on GDN Style and book your appointment online. ${
      count === 1 ? "1 venue available" : `${count} venues available`
    } in New York and New Jersey.`,
    alternates: { canonical: `/venues/category/${slug}` },
    openGraph: {
      title: `${name} · GDN Style`,
      description: `Book ${name.toLowerCase()} at the best venues, rated by real clients.`,
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
