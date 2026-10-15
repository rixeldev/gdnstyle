import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  DbLocation,
  DbProvider,
  DbProviderLocation,
  DbProviderPortfolio,
  DbProviderReview,
  DbProviderService,
} from "@/interfaces/marketplace"

const PROVIDER_LOCATION_COLUMNS = "id,provider_id,location_id,category,image"

/** Everything a public professional profile needs, in one round-trip batch. */
export interface ProviderProfileData {
  provider: DbProvider
  services: DbProviderService[]
  reviews: DbProviderReview[]
  portfolio: DbProviderPortfolio[]
  locations: DbLocation[]
}

const PROFILE_PROVIDER_COLUMNS = [
  "id",
  "user_id",
  "full_name",
  "business_name",
  "email",
  "phone",
  "photo",
  "rating",
  "reviews",
  "charges_enabled",
  "stripe_onboarding_completed",
  "identity_verified",
  "address_line1",
  "address_line2",
  "address_city",
  "address_state",
  "address_postal_code",
  "address_country",
  "social_facebook",
  "social_instagram",
  "social_tiktok",
  "social_twitter",
  "social_youtube",
  "social_whatsapp",
].join(",")

const PROFILE_SERVICE_COLUMNS =
  "id,provider_id,name,description,category,price,duration,is_active,image_url"
const PROFILE_REVIEW_COLUMNS =
  "id,provider_id,client_id,appointment_id,rating,comment,service_name,reviewer_name,reviewer_avatar_url,created_at"
const PROFILE_PORTFOLIO_COLUMNS =
  "id,provider_id,image_url,title,description,likes_count,comments_count,created_at"
const PROFILE_LOCATION_COLUMNS =
  "id,name,address,city,state,country,postal_code,latitude,longitude,image_url,image_alt,category"

/**
 * Load a professional's public profile in as few round-trips as possible:
 * the provider row, its active services, reviews and portfolio, plus the
 * venues it is linked to through `provider_locations`.
 */
export async function fetchProviderProfileData(
  client: SupabaseClient,
  providerId: string,
): Promise<ProviderProfileData | null> {
  const providerResult = await client
    .from("providers")
    .select(PROFILE_PROVIDER_COLUMNS)
    .eq("id", providerId)
    .maybeSingle()

  if (providerResult.error) {
    console.error("[providers] failed to load the profile row", providerResult.error)
    return null
  }
  if (!providerResult.data) return null

  const provider = providerResult.data as unknown as DbProvider

  const [services, reviews, portfolio, links] = await Promise.all([
    client
      .from("provider_services")
      .select(PROFILE_SERVICE_COLUMNS)
      .eq("provider_id", providerId)
      .eq("is_active", true)
      .order("price"),
    client
      .from("provider_reviews")
      .select(PROFILE_REVIEW_COLUMNS)
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false }),
    client
      .from("provider_portfolio")
      .select(PROFILE_PORTFOLIO_COLUMNS)
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false }),
    client
      .from("provider_locations")
      .select(PROVIDER_LOCATION_COLUMNS)
      .eq("provider_id", providerId),
  ])

  const providerLocations = (links.error ? [] : (links.data ?? [])) as DbProviderLocation[]
  const locationIds = Array.from(new Set(providerLocations.map((link) => link.location_id)))

  const locationsResult = locationIds.length
    ? await client.from("locations").select(PROFILE_LOCATION_COLUMNS).in("id", locationIds)
    : { data: [], error: null }

  return {
    provider,
    services: (services.error ? [] : (services.data ?? [])) as DbProviderService[],
    reviews: (reviews.error ? [] : (reviews.data ?? [])) as DbProviderReview[],
    portfolio: (portfolio.error ? [] : (portfolio.data ?? [])) as DbProviderPortfolio[],
    locations: (locationsResult.error ? [] : (locationsResult.data ?? [])) as DbLocation[],
  }
}

/**
 * The `providers` row owned by `auth.uid()`. Its presence is what makes a
 * signed-in visitor a professional (never `profiles.role`). The address columns
 * are read too: they are the ones the public card renders, so the account
 * dialog edits the row the marketplace actually shows.
 */
export async function fetchProviderForUser(
  client: SupabaseClient,
  userId: string,
): Promise<DbProvider | null> {
  const { data, error } = await client
    .from("providers")
    .select(
      "id,user_id,full_name,business_name,email,phone,photo,rating,reviews,charges_enabled,stripe_onboarding_completed,address_line1,address_line2,address_city,address_state,address_postal_code,address_country,social_instagram,social_tiktok,social_whatsapp",
    )
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[providers] failed to load the provider row", error)
    return null
  }

  return (data as DbProvider | null) ?? null
}

/** Columns a professional may change on the `providers` row they own. */
export interface OwnedProviderPatch {
  full_name?: string | null
  business_name?: string | null
  phone?: string | null
  address_line1?: string | null
  address_line2?: string | null
  address_city?: string | null
  address_state?: string | null
  address_postal_code?: string | null
  address_country?: string | null
  social_instagram?: string | null
  social_tiktok?: string | null
  social_whatsapp?: string | null
}

/**
 * Save the professional's public card. Possible since migration 0007: until it,
 * the row was written once by the signup trigger (`security definer`) and no
 * policy let its owner touch it again, so the name, the address and the socials
 * collected at signup were frozen forever.
 *
 * Returns `false` when PostgREST rejects the write (RLS, missing row), which is
 * what a rejected update looks like from the client.
 */
export async function updateOwnedProvider(
  client: SupabaseClient,
  providerId: string,
  patch: OwnedProviderPatch,
): Promise<boolean> {
  const { error } = await client.from("providers").update(patch).eq("id", providerId)

  if (error) {
    console.error("[providers] failed to save the card", error)
    return false
  }

  return true
}

/** Venues linked to a provider (the professional's own listings). */
export async function fetchProviderLocations(
  client: SupabaseClient,
  providerId: string,
): Promise<DbProviderLocation[]> {
  const { data, error } = await client
    .from("provider_locations")
    .select(PROVIDER_LOCATION_COLUMNS)
    .eq("provider_id", providerId)

  if (error) {
    console.error("[provider_locations] failed to load the provider venues", error)
    return []
  }

  return (data ?? []) as DbProviderLocation[]
}

/** Columns a professional may change on a location they already own. */
export interface ProviderLocationPatch {
  /** Comma-separated `business_categories.category` values. */
  category?: string | null
  image?: string | null
}

/**
 * Persist the editable `provider_locations` columns. `locations` has no owner
 * UPDATE policy, so category/photos are the only fields a professional can
 * change on an existing venue.
 */
export async function updateProviderLocation(
  client: SupabaseClient,
  id: string,
  patch: ProviderLocationPatch,
): Promise<boolean> {
  const { error } = await client.from("provider_locations").update(patch).eq("id", id)

  if (error) {
    console.error("[provider_locations] failed to update the venue", error)
    return false
  }

  return true
}

/** Address columns a professional may write on a `locations` row they own. */
export interface LocationAddressPatch {
  name?: string | null
  /** The form's "area" maps to the location address. */
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  latitude?: number | null
  longitude?: number | null
  image_url?: string | null
  image_alt?: string | null
}

/**
 * Save the address of a `locations` row the professional owns. Only possible
 * since migration 0006: before it, `locations` accepted an INSERT and exposed
 * a public SELECT but had no UPDATE policy, so an address was write-once. The
 * policy reaches ownership through `provider_locations`, because the table has
 * no owner column of its own.
 *
 * Returns `false` when PostgREST rejects the write (RLS, missing row), which is
 * what a rejected update looks like from the client.
 */
export async function updateOwnedLocation(
  client: SupabaseClient,
  locationId: string,
  patch: LocationAddressPatch,
): Promise<boolean> {
  const { error } = await client.from("locations").update(patch).eq("id", locationId)

  if (error) {
    console.error("[locations] failed to save the address", error)
    return false
  }

  return true
}

/** A venue a professional is creating: a `locations` row plus the ownership link. */
export interface NewProviderLocation {
  providerId: string
  name: string
  /** The form's "area" maps to the location address. */
  address: string | null
  city: string
  state: string | null
  country: string | null
  /** ZIP code, or `null` when the professional left it blank. */
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  /** Comma-separated `business_categories.category` values. */
  category: string
  image: string | null
  imageAlt: string | null
}

/**
 * Create a venue: insert the `locations` row (authenticated insert is allowed)
 * and then the `provider_locations` link that owns it. Returns the new location
 * id, or `null` when either write fails.
 */
export async function createProviderLocation(
  client: SupabaseClient,
  input: NewProviderLocation,
): Promise<string | null> {
  const { data, error } = await client
    .from("locations")
    .insert({
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      postal_code: input.postalCode,
      latitude: input.latitude,
      longitude: input.longitude,
      category: input.category,
      image_url: input.image,
      image_alt: input.imageAlt,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[locations] failed to create the venue", error)
    return null
  }

  const locationId = (data as { id: string }).id

  const { error: linkError } = await client.from("provider_locations").insert({
    provider_id: input.providerId,
    location_id: locationId,
    category: input.category,
    image: input.image,
  })

  if (linkError) {
    console.error("[provider_locations] failed to link the new venue", linkError)
    return null
  }

  return locationId
}
