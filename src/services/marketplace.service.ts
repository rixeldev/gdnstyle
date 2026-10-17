import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  DbBusinessCategory,
  DbLocation,
  DbLocationReview,
  DbProvider,
  DbProviderLocation,
  DbProviderService,
} from "@/interfaces/marketplace"

/** Everything the catalog adapter needs, fetched in as few round-trips as possible. */
export interface CatalogData {
  categories: DbBusinessCategory[]
  locations: DbLocation[]
  providers: DbProvider[]
  providerLocations: DbProviderLocation[]
  services: DbProviderService[]
  reviews: DbLocationReview[]
}

const CATEGORY_COLUMNS = "id,category,image_category"
const LOCATION_COLUMNS =
  "id,name,address,city,state,country,postal_code,latitude,longitude,image_url,image_alt,category"
// The public catalog reads the `provider_public` view (migration 0012), which
// answers for these columns: `providers` itself answers only its owner, so the
// Stripe and identity columns never leave the table. `timezone` rides along so
// the booking grid can tell past hours in the venue's own clock.
const PROVIDER_COLUMNS =
  "id,user_id,full_name,business_name,email,phone,photo,rating,reviews,charges_enabled,stripe_onboarding_completed,social_instagram,social_whatsapp,timezone"
const PROVIDER_LOCATION_COLUMNS = "id,provider_id,location_id,category,image"
const PROVIDER_SERVICE_COLUMNS =
  "id,provider_id,name,description,category,price,duration,image_url,is_active"
const REVIEW_COLUMNS =
  "id,location_id,client_id,rating,comment,reviewer_name,reviewer_avatar_url,created_at"

interface QueryResult {
  data: unknown
  error: { message: string } | null
}

/** Supabase returns `{ data, error }`; log the failure and fall back to `[]`. */
function rows<T>(result: QueryResult, label: string): T[] {
  if (result.error) {
    console.error(`[marketplace] ${label}: ${result.error.message}`)
    return []
  }
  return Array.isArray(result.data) ? (result.data as T[]) : []
}

/** Load the public marketplace catalog (locations + providers + services). */
export async function fetchCatalogData(client: SupabaseClient): Promise<CatalogData> {
  const [categories, locations, providers, providerLocations, services, reviews] =
    await Promise.all([
      client.from("business_categories").select(CATEGORY_COLUMNS).order("category"),
      client.from("locations").select(LOCATION_COLUMNS),
      client.from("provider_public").select(PROVIDER_COLUMNS),
      client.from("provider_locations").select(PROVIDER_LOCATION_COLUMNS),
      client.from("provider_services").select(PROVIDER_SERVICE_COLUMNS).eq("is_active", true),
      client.from("location_reviews").select(REVIEW_COLUMNS),
    ])

  return {
    categories: rows<DbBusinessCategory>(categories, "business_categories"),
    locations: rows<DbLocation>(locations, "locations"),
    providers: rows<DbProvider>(providers, "providers"),
    providerLocations: rows<DbProviderLocation>(providerLocations, "provider_locations"),
    services: rows<DbProviderService>(services, "provider_services"),
    reviews: rows<DbLocationReview>(reviews, "location_reviews"),
  }
}

/**
 * Fetch a single location plus the providers, services and reviews linked to
 * it. `provider_services` has no foreign key to `providers`, so the services
 * are queried by the provider ids found through `provider_locations`.
 */
export async function fetchCatalogForLocation(
  client: SupabaseClient,
  locationId: string,
): Promise<CatalogData | null> {
  const locationResult = await client
    .from("locations")
    .select(LOCATION_COLUMNS)
    .eq("id", locationId)
    .maybeSingle()

  if (locationResult.error) {
    console.error(`[marketplace] locations: ${locationResult.error.message}`)
    return null
  }
  if (!locationResult.data) return null

  const location = locationResult.data as DbLocation
  const providerLocations = rows<DbProviderLocation>(
    await client
      .from("provider_locations")
      .select(PROVIDER_LOCATION_COLUMNS)
      .eq("location_id", locationId),
    "provider_locations",
  )
  const providerIds = providerLocations.map((link) => link.provider_id)

  const [providers, services, reviews] = await Promise.all([
    providerIds.length
      ? client.from("provider_public").select(PROVIDER_COLUMNS).in("id", providerIds)
      : Promise.resolve({ data: [], error: null }),
    providerIds.length
      ? client
          .from("provider_services")
          .select(PROVIDER_SERVICE_COLUMNS)
          .in("provider_id", providerIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    client.from("location_reviews").select(REVIEW_COLUMNS).eq("location_id", locationId),
  ])

  return {
    categories: [],
    locations: [location],
    providers: rows<DbProvider>(providers, "providers"),
    providerLocations,
    services: rows<DbProviderService>(services, "provider_services"),
    reviews: rows<DbLocationReview>(reviews, "location_reviews"),
  }
}

/** Public category list (used by the directory filter). */
export async function fetchBusinessCategories(
  client: SupabaseClient,
): Promise<DbBusinessCategory[]> {
  return rows<DbBusinessCategory>(
    await client.from("business_categories").select(CATEGORY_COLUMNS).order("category"),
    "business_categories",
  )
}
