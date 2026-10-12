import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { VenueDirectory } from "@/components/venues/venue-directory"
import { VenueShell } from "@/components/venues/venue-shell"
import { CATEGORIES, getCategoryBySlug } from "@/constants/categories"
import { VENUES } from "@/constants/venues"
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

/** Prerender one landing page per category. */
export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ slug: category.slug }))
}

/** Server-side labels are always Spanish (the locale is applied on the client). */
function categoryLabel(categoryId: string): string {
  return (es.categories as Record<string, string>)[categoryId] ?? categoryId
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) return { title: "Categoría no encontrada" }

  const name = categoryLabel(category.id)
  const count = VENUES.filter((venue) => venue.categoryId === category.id).length

  return {
    title: `${name} en República Dominicana`,
    description: `Encuentra locales de ${name.toLowerCase()} en GDN Style y reserva tu cita online. ${
      count === 1 ? "1 local disponible" : `${count} locales disponibles`
    } en Santo Domingo, Santiago, Punta Cana y más.`,
    alternates: { canonical: `/locales/categoria/${slug}` },
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

  return (
    <VenueShell>
      <VenueDirectory initialCategory={category.id} />
    </VenueShell>
  )
}
