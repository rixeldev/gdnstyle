import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProviderProfileView } from "@/components/providers/provider-profile"
import { VenueShell } from "@/components/venues/venue-shell"
import type { ProviderProfile } from "@/constants/provider-profile"
import { SITE } from "@/constants/site"
import { getServerProvider } from "@/libs/marketplace/server"
import { jsonLdHtml } from "@/utils/json-ld"

interface ProviderPageProps {
  params: Promise<{ id: string }>
}

/**
 * Blocking route: the record is looked up from `params` and there is no
 * meaningful streaming shell, so we opt out of instant-navigation validation
 * (same reasoning as `/venues/[id]`).
 */
export const instant = false

/** Absolute URL for photos that may be local paths or Supabase Storage. */
function absoluteUrl(value: string): string {
  if (!value) return `${SITE.url}/icono.png`
  return /^https?:\/\//i.test(value) ? value : `${SITE.url}${value}`
}

function buildJsonLd(profile: ProviderProfile) {
  const hasRating = profile.reviews > 0 && profile.rating > 0

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: `${SITE.url}/professionals/${profile.id}`,
    ...(profile.photo ? { image: absoluteUrl(profile.photo) } : {}),
    jobTitle: profile.specialties[0] ?? undefined,
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(profile.venues[0]
      ? {
          address: {
            "@type": "PostalAddress",
            ...(profile.venues[0].address ? { streetAddress: profile.venues[0].address } : {}),
            addressLocality: profile.venues[0].city,
            addressCountry: profile.venues[0].country ?? "US",
          },
        }
      : {}),
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: profile.rating,
            reviewCount: profile.reviews,
            bestRating: 5,
          },
        }
      : {}),
  }
}

export async function generateMetadata({ params }: ProviderPageProps): Promise<Metadata> {
  const { id } = await params
  const profile = await getServerProvider(id)

  if (!profile) {
    return { title: "Professional", robots: { index: false, follow: false } }
  }

  const location = [profile.address, profile.city].filter(Boolean).join(", ")
  const description = location
    ? `Book with ${profile.name} (${location}). Services, portfolio and reviews on GDN Style.`
    : `Book with ${profile.name} on GDN Style. Services, portfolio and reviews.`

  return {
    title: `${profile.name} · GDN Style`,
    description,
    alternates: { canonical: `/professionals/${profile.id}` },
    openGraph: {
      title: `${profile.name} · GDN Style`,
      description,
      type: "profile",
      ...(profile.photo
        ? { images: [{ url: absoluteUrl(profile.photo), alt: profile.name }] }
        : {}),
    },
  }
}

/** Public professional profile with `Person` structured data. */
export default async function ProviderPage({ params }: ProviderPageProps) {
  const { id } = await params
  const profile = await getServerProvider(id)
  if (!profile) notFound()

  return (
    <VenueShell>
      <script
        type="application/ld+json"
        // Structured data is generated from the database record.
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(buildJsonLd(profile)) }}
      />
      <ProviderProfileView profile={profile} />
    </VenueShell>
  )
}
