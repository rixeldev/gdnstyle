import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { VenueDirectory } from "@/components/venues/venue-directory"
import { VenueShell } from "@/components/venues/venue-shell"
import { VENUES, VENUE_CITIES } from "@/constants/venues"
import { slugify } from "@/utils/slug"

interface CityPageProps {
  params: Promise<{ slug: string }>
}

/**
 * Blocking route: the city comes from `params` and the list is filtered from
 * it, so opt out of instant-navigation validation (it still prerenders via
 * `generateStaticParams`).
 */
export const instant = false

function cityBySlug(slug: string): string | undefined {
  return VENUE_CITIES.find((city) => slugify(city) === slug)
}

/** Prerender one landing page per city. */
export function generateStaticParams() {
  return VENUE_CITIES.map((city) => ({ slug: slugify(city) }))
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { slug } = await params
  const city = cityBySlug(slug)
  if (!city) return { title: "Ciudad no encontrada" }

  const count = VENUES.filter((venue) => venue.city === city).length

  return {
    title: `Locales de belleza en ${city}`,
    description: `Salones, barberías y estudios de belleza en ${city}. ${
      count === 1 ? "1 local" : `${count} locales`
    } valorados por clientas reales. Reserva tu cita online en GDN Style.`,
    alternates: { canonical: `/locales/ciudad/${slug}` },
    openGraph: {
      title: `Belleza en ${city} · GDN Style`,
      description: `Descubre y reserva los mejores locales de ${city}.`,
    },
  }
}

/** SEO landing page for a city. */
export default async function CityPage({ params }: CityPageProps) {
  const { slug } = await params
  const city = cityBySlug(slug)
  if (!city) notFound()

  return (
    <VenueShell>
      <VenueDirectory initialCity={city} />
    </VenueShell>
  )
}
