import { connection } from "next/server"

import type { ProviderProfile } from "@/constants/provider-profile"
import { VENUES, type Venue } from "@/constants/venues"
import { getProfessionalById } from "@/constants/professionals"
import { adaptVenues } from "@/libs/marketplace/adapt"
import { adaptProviderProfile } from "@/libs/marketplace/provider-adapt"
import { createSupabaseServerClient } from "@/libs/supabase/server"
import { fetchCatalogData, fetchCatalogForLocation } from "@/services/marketplace.service"
import { fetchProviderProfileData } from "@/services/provider.service"

/**
 * Public catalog resolved on the server so the directory and venue pages paint
 * with real records (and correct SSR markup). Without Supabase credentials the
 * static test records are returned so the demo keeps working.
 *
 * The route is request-dependent (the shell would otherwise be served while the
 * uncached Supabase query is still in flight, and Next aborts it on completion).
 */
export async function getServerCatalog(): Promise<Venue[]> {
  await connection()

  const client = await createSupabaseServerClient()
  if (!client) return VENUES

  try {
    return adaptVenues(await fetchCatalogData(client))
  } catch (error) {
    console.error("[marketplace] failed to load the server catalog", error)
    return []
  }
}

/** A single venue for the detail page (or `null` when it does not exist). */
export async function getServerVenue(id: string): Promise<Venue | null> {
  await connection()

  const client = await createSupabaseServerClient()
  if (!client) return VENUES.find((venue) => venue.id === id) ?? null

  try {
    const data = await fetchCatalogForLocation(client, id)
    if (!data) return null
    return adaptVenues(data)[0] ?? null
  } catch (error) {
    // A locally-created id (not a uuid) is expected to fail here.
    console.error("[marketplace] failed to load the venue", error)
    return null
  }
}

/** Distinct cities present in a catalog, for SEO landings and sitemaps. */
export function catalogCities(venues: Venue[]): string[] {
  return Array.from(new Set(venues.map((venue) => venue.city).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}

/**
 * Static fallback profile for the no-credentials demo. Static professionals are
 * keyed by slug and carry no services, reviews, portfolio or venues.
 */
function staticProviderProfile(id: string): ProviderProfile | null {
  const professional = getProfessionalById(id)
  if (!professional) return null

  return {
    id: professional.id,
    name: professional.name,
    rating: 0,
    reviews: 0,
    verified: false,
    specialties: [],
    categoryIds: professional.categoryIds,
    socials: {},
    services: [],
    reviewsList: [],
    portfolio: [],
    venues: [],
    source: "static",
  }
}

/**
 * A single professional profile for its public page (or `null` when neither the
 * database nor the static demo has the record).
 */
export async function getServerProvider(id: string): Promise<ProviderProfile | null> {
  await connection()

  const client = await createSupabaseServerClient()
  if (!client) return staticProviderProfile(id)

  try {
    const data = await fetchProviderProfileData(client, id)
    if (!data) return null
    return adaptProviderProfile(data)
  } catch (error) {
    // A static slug (not a uuid) is expected to fail here.
    console.error("[marketplace] failed to load the provider", error)
    return null
  }
}
