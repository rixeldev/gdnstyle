import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { VenueDirectory } from "@/components/venues/venue-directory"
import { VenueShell } from "@/components/venues/venue-shell"
import { catalogCities, getServerCatalog } from "@/libs/marketplace/server"
import { slugify } from "@/utils/slug"

interface CityPageProps {
  params: Promise<{ slug: string }>
}

/**
 * Blocking route: the city comes from `params` and the list is filtered from
 * it, so opt out of instant-navigation validation. The city list comes from the
 * live catalog, so there is no `generateStaticParams`.
 */
export const instant = false

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { slug } = await params
  const venues = await getServerCatalog()
  const city = catalogCities(venues).find((item) => slugify(item) === slug)
  if (!city) return { title: "Ciudad no encontrada" }

  const count = venues.filter((venue) => venue.city === city).length

  return {
    title: `Locales de belleza en ${city}`,
    description: `Encuentra locales en ${city} en GDN Style y reserva tu cita online. ${
      count === 1 ? "1 local disponible" : `${count} locales disponibles`
    }.`,
    alternates: { canonical: `/venues/city/${slug}` },
    openGraph: {
      title: `${city} · GDN Style`,
      description: `Reserva tu cita en los mejores locales de ${city}.`,
    },
  }
}

/** SEO landing page for a city. */
export default async function CityPage({ params }: CityPageProps) {
  const { slug } = await params
  const venues = await getServerCatalog()
  const city = catalogCities(venues).find((item) => slugify(item) === slug)
  if (!city) notFound()

  return (
    <VenueShell>
      <VenueDirectory initialCity={city} initialVenues={venues} />
    </VenueShell>
  )
}
