import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { VenueShell } from "@/components/venues/venue-shell"
import { VenueDetailRoute } from "@/components/venues/venue-detail-route"
import { SITE } from "@/constants/site"
import type { Venue } from "@/constants/venues"
import { getServerVenue } from "@/libs/marketplace/server"
import { isCustomVenueId } from "@/libs/venue-store"
import { jsonLdHtml } from "@/utils/json-ld"
import { venueLocationLabel } from "@/utils/venue"

interface VenuePageProps {
  params: Promise<{ id: string }>
}

/**
 * Blocking route: the record is looked up from `params` and there is no
 * meaningful streaming shell, so we opt out of instant-navigation validation
 * (same reasoning as `/venues`).
 */
export const instant = false

/** Absolute URL for photos that may be local paths or Supabase Storage. */
function absoluteUrl(value: string): string {
  if (!value) return `${SITE.url}/icono.png`
  return /^https?:\/\//i.test(value) ? value : `${SITE.url}${value}`
}

function buildJsonLd(venue: Venue) {
  const hasRating = venue.reviews > 0 && venue.rating > 0

  return {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: venue.name,
    url: `${SITE.url}/venues/${venue.id}`,
    image: venue.gallery.map((photo) => absoluteUrl(photo)),
    priceRange: `US$${venue.priceFrom}+`,
    currenciesAccepted: SITE.currency,
    address: {
      "@type": "PostalAddress",
      ...(venue.address ? { streetAddress: venue.address } : {}),
      addressLocality: venue.city,
      ...(venue.source === "database" ? {} : { addressRegion: venue.area }),
      addressCountry: venue.country ?? "US",
    },
    ...(venue.hasCoords === false
      ? {}
      : {
          geo: {
            "@type": "GeoCoordinates",
            latitude: venue.lat,
            longitude: venue.lon,
          },
        }),
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: venue.rating,
            reviewCount: venue.reviews,
            bestRating: 5,
          },
        }
      : {}),
  }
}

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const { id } = await params
  const venue = await getServerVenue(id)

  if (!venue) {
    // Locally-created venues are unknown to the server; keep them out of search.
    return { title: "Venue", robots: { index: false, follow: false } }
  }

  const location = venueLocationLabel(venue)
  const description = `Book an appointment at ${venue.name} (${location}). Rated ${venue.rating} stars by ${venue.reviews} clients. Prices from US$${venue.priceFrom} on GDN Style.`

  return {
    title: `${venue.name} · ${location}`,
    description,
    alternates: { canonical: `/venues/${venue.id}` },
    openGraph: {
      title: `${venue.name} · GDN Style`,
      description,
      type: "website",
      images: [{ url: absoluteUrl(venue.image), alt: venue.name }],
    },
  }
}

/** Single venue page with `BeautySalon` structured data for rich results. */
export default async function VenuePage({ params }: VenuePageProps) {
  const { id } = await params
  const venue = await getServerVenue(id)
  // Locally-created records are client-only; the wrapper resolves or 404s them.
  if (!venue && !isCustomVenueId(id)) notFound()

  return (
    <VenueShell>
      {venue && (
        <script
          type="application/ld+json"
          // Structured data is generated from the database/static records.
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(buildJsonLd(venue)) }}
        />
      )}
      <VenueDetailRoute id={id} initialVenue={venue} />
    </VenueShell>
  )
}
