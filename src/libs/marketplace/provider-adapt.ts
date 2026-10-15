import type {
  ProviderPortfolioItem,
  ProviderProfile,
  ProviderReviewItem,
  ProviderServiceItem,
  ProviderVenue,
} from "@/constants/provider-profile"
import {
  categoryIdsFromNames,
  normalizeCity,
  round1,
  splitCategoryNames,
} from "@/libs/marketplace/adapt"
import type { ProviderProfileData } from "@/services/provider.service"

/** Provider display name: business name first, then personal name. */
function providerDisplayName(fullName: string | null, businessName: string | null): string {
  return businessName?.trim() || fullName?.trim() || "Profesional"
}

/**
 * Build the public profile from the raw Supabase bundle. Missing services,
 * reviews, portfolio and venues collapse to empty arrays so the page renders
 * clean empty states instead of failing.
 */
export function adaptProviderProfile(data: ProviderProfileData): ProviderProfile {
  const { provider } = data

  const services: ProviderServiceItem[] = data.services.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description?.trim() || undefined,
    category: service.category?.trim() || undefined,
    price: Number(service.price) || 0,
    durationMin: Number(service.duration) || 0,
    imageUrl: service.image_url ?? undefined,
  }))

  const reviewsList: ProviderReviewItem[] = [...data.reviews]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map((review) => ({
      id: review.id,
      author: review.reviewer_name?.trim() || undefined,
      avatarUrl: review.reviewer_avatar_url ?? undefined,
      rating: Number(review.rating) || 0,
      text: review.comment?.trim() ?? "",
      serviceName: review.service_name?.trim() || undefined,
      createdAt: review.created_at ?? undefined,
    }))

  // `providers.rating`/`providers.reviews` are denormalized and can lag behind
  // the actual rows (some are still 0). Prefer the live aggregate from
  // `provider_reviews`, mirroring how venue ratings are derived.
  const reviewRatings = reviewsList.map((review) => review.rating).filter((value) => value > 0)
  const rating =
    reviewRatings.length > 0
      ? round1(reviewRatings.reduce((sum, value) => sum + value, 0) / reviewRatings.length)
      : Number(provider.rating) || 0
  const reviewCount = reviewsList.length > 0 ? reviewsList.length : Number(provider.reviews) || 0

  const portfolio: ProviderPortfolioItem[] = data.portfolio
    .filter((item) => Boolean(item.image_url))
    .map((item) => ({
      id: item.id,
      imageUrl: item.image_url as string,
      title: item.title?.trim() || undefined,
      description: item.description?.trim() || undefined,
      likes: Number(item.likes_count) || 0,
      comments: Number(item.comments_count) || 0,
    }))

  const venues: ProviderVenue[] = data.locations.map((location) => ({
    id: location.id,
    name: location.name,
    address: location.address?.trim() || undefined,
    city: normalizeCity(location.city) || undefined,
    country: location.country ?? undefined,
    lat: location.latitude ?? 0,
    lon: location.longitude ?? 0,
    hasCoords: location.latitude != null && location.longitude != null,
  }))

  // Specialties are the distinct category names across the services and the
  // venues the professional is linked to.
  const specialtyNames = Array.from(
    new Set([
      ...data.services.flatMap((service) => splitCategoryNames(service.category)),
      ...data.locations.flatMap((location) => splitCategoryNames(location.category)),
    ]),
  )

  const street = [provider.address_line1, provider.address_line2]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ")

  return {
    id: provider.id,
    name: providerDisplayName(provider.full_name, provider.business_name),
    businessName: provider.business_name?.trim() || undefined,
    photo: provider.photo ?? undefined,
    rating,
    reviews: reviewCount,
    verified: Boolean(provider.identity_verified),
    phone: provider.phone ?? provider.social_whatsapp ?? undefined,
    email: provider.email ?? undefined,
    address: street || undefined,
    city: provider.address_city?.trim() || undefined,
    country: provider.address_country?.trim() || undefined,
    specialties: specialtyNames,
    categoryIds: categoryIdsFromNames(specialtyNames),
    socials: {
      facebook: provider.social_facebook ?? undefined,
      instagram: provider.social_instagram ?? undefined,
      tiktok: provider.social_tiktok ?? undefined,
      twitter: provider.social_twitter ?? undefined,
      youtube: provider.social_youtube ?? undefined,
      whatsapp: provider.social_whatsapp ?? undefined,
    },
    services,
    reviewsList,
    portfolio,
    venues,
    source: "database",
  }
}
