/**
 * Row shapes for the live marketplace tables (see `docs/data.md`). Only the
 * columns the UI reads are listed; the database is the source of truth, so keep
 * these in sync with the Supabase project rather than inventing fields.
 */

export interface DbBusinessCategory {
  id: string
  category: string
  image_category: string | null
}

export interface DbLocation {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  image_url: string | null
  /** The database reuses this column to store a second gallery image URL. */
  image_alt: string | null
  /** Comma-separated list of `business_categories.category` values. */
  category: string | null
}

export interface DbProvider {
  id: string
  user_id: string
  full_name: string | null
  business_name: string | null
  email: string | null
  phone: string | null
  photo: string | null
  rating: number | null
  reviews: number | null
  charges_enabled: boolean | null
  stripe_onboarding_completed: boolean | null
  identity_verified: boolean | null
  address_line1: string | null
  address_line2: string | null
  address_city: string | null
  address_state: string | null
  address_postal_code: string | null
  address_country: string | null
  social_facebook: string | null
  social_instagram: string | null
  social_tiktok: string | null
  social_twitter: string | null
  social_youtube: string | null
  social_whatsapp: string | null
}

/** A work sample shown in a professional's portfolio (`provider_portfolio`). */
export interface DbProviderPortfolio {
  id: string
  provider_id: string
  image_url: string | null
  title: string | null
  description: string | null
  likes_count: number | null
  comments_count: number | null
  created_at: string | null
}

/** A customer review of a professional (`provider_reviews`). */
export interface DbProviderReview {
  id: string
  provider_id: string
  client_id: string | null
  appointment_id: string | null
  rating: number
  comment: string | null
  service_name: string | null
  reviewer_name: string | null
  reviewer_avatar_url: string | null
  created_at: string | null
}

export interface DbProviderLocation {
  id: string
  provider_id: string
  location_id: string
  /** Comma-separated categories this provider offers at the location. */
  category: string | null
  image: string | null
}

export interface DbProviderService {
  id: string
  provider_id: string
  name: string
  description: string | null
  category: string | null
  price: number
  duration: number
  image_url: string | null
  is_active: boolean
}

export interface DbLocationReview {
  id: string
  location_id: string
  client_id: string | null
  rating: number
  comment: string | null
  reviewer_name: string | null
  reviewer_avatar_url: string | null
  created_at: string | null
}
