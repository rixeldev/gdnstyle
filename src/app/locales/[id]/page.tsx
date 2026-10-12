import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { VenueShell } from "@/components/venues/venue-shell"
import { VenueDetail } from "@/components/venues/venue-detail"
import { SITE } from "@/constants/site"
import { VENUES } from "@/constants/venues"

interface VenuePageProps {
  params: Promise<{ id: string }>
}

/**
 * Blocking route: the record is looked up from `params` and there is no
 * meaningful streaming shell, so we opt out of instant-navigation validation
 * (same reasoning as `/locales`). `generateStaticParams` still prerenders the
 * known records.
 */
export const instant = false

/** Prerender the test records; unknown ids fall back to a dynamic 404. */
export function generateStaticParams() {
  return VENUES.map((venue) => ({ id: venue.id }))
}

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const { id } = await params
  const venue = VENUES.find((item) => item.id === id)

  if (!venue) {
    return { title: "Local no encontrado" }
  }

  const title = `${venue.name} · ${venue.area}, ${venue.city}`
  const description = `Reserva cita en ${venue.name} (${venue.area}, ${venue.city}). Valorado con ${venue.rating} estrellas por ${venue.reviews} clientas. Precios desde RD$${venue.priceFrom} en GDN Style.`

  return {
    title,
    description,
    alternates: { canonical: `/locales/${venue.id}` },
    openGraph: {
      title: `${venue.name} · GDN Style`,
      description,
      type: "website",
      images: [{ url: `${SITE.url}${venue.image}`, alt: venue.name }],
    },
  }
}

/** Single venue page with `BeautySalon` structured data for rich results. */
export default async function VenuePage({ params }: VenuePageProps) {
  const { id } = await params
  const venue = VENUES.find((item) => item.id === id)
  if (!venue) notFound()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: venue.name,
    url: `${SITE.url}/locales/${venue.id}`,
    image: venue.gallery.map((photo) => `${SITE.url}${photo}`),
    priceRange: `RD$${venue.priceFrom}+`,
    currenciesAccepted: SITE.currency,
    address: {
      "@type": "PostalAddress",
      addressLocality: venue.city,
      addressRegion: venue.area,
      addressCountry: "DO",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: venue.lat,
      longitude: venue.lon,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: venue.rating,
      reviewCount: venue.reviews,
      bestRating: 5,
    },
  }

  return (
    <VenueShell>
      <script
        type="application/ld+json"
        // Structured data is generated from our own constants (no user input).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VenueDetail venue={venue} />
    </VenueShell>
  )
}
