/**
 * UI shape of a professional's public profile. Built from the live
 * `providers` row plus its services, reviews, portfolio and linked venues
 * (`@/libs/marketplace/provider-adapt`), so the components stay presentational.
 */

/** A bookable service (`provider_services`) with its price and duration. */
export interface ProviderServiceItem {
  id: string
  name: string
  description?: string
  category?: string
  /** Price in USD. */
  price: number
  /** Duration in minutes. */
  durationMin: number
  imageUrl?: string
}

/** A customer review (`provider_reviews`). */
export interface ProviderReviewItem {
  id: string
  author?: string
  avatarUrl?: string
  rating: number
  text: string
  serviceName?: string
  createdAt?: string
}

/** A work sample (`provider_portfolio`). */
export interface ProviderPortfolioItem {
  id: string
  imageUrl: string
  title?: string
  description?: string
  likes: number
  comments: number
}

/** A beauty establishment where the professional works (`locations`). */
export interface ProviderVenue {
  id: string
  name: string
  address?: string
  city?: string
  country?: string
  lat: number
  lon: number
  hasCoords: boolean
}

/** Social profiles linked from the provider row. */
export interface ProviderSocials {
  facebook?: string
  instagram?: string
  tiktok?: string
  twitter?: string
  youtube?: string
  whatsapp?: string
}

export interface ProviderProfile {
  id: string
  name: string
  businessName?: string
  photo?: string
  rating: number
  reviews: number
  /** `true` when `providers.identity_verified` is set. */
  verified: boolean
  phone?: string
  email?: string
  /** Formatted street address from the provider row, when present. */
  address?: string
  city?: string
  country?: string
  /** Raw `business_categories.category` names the professional works with. */
  specialties: string[]
  /** Canonical category ids derived from `specialties`. */
  categoryIds: string[]
  socials: ProviderSocials
  services: ProviderServiceItem[]
  reviewsList: ProviderReviewItem[]
  portfolio: ProviderPortfolioItem[]
  venues: ProviderVenue[]
  source: "database" | "static"
}

/** A social link ready to render (label + href + icon). */
export interface ProviderSocialLink {
  key: keyof ProviderSocials
  label: string
  href: string
}

/** Turn stored social handles/URLs into clickable links, skipping empties. */
export function providerSocialLinks(socials: ProviderSocials): ProviderSocialLink[] {
  const links: ProviderSocialLink[] = []
  const trimmed = (value?: string) => value?.trim() || undefined

  const instagram = trimmed(socials.instagram)
  if (instagram) {
    const handle = instagram.replace(/^@/, "")
    links.push({
      key: "instagram",
      label: instagram.startsWith("@") ? instagram : `@${handle}`,
      href: /^https?:\/\//i.test(instagram) ? instagram : `https://instagram.com/${handle}`,
    })
  }

  const facebook = trimmed(socials.facebook)
  if (facebook) {
    links.push({
      key: "facebook",
      label: "Facebook",
      href: /^https?:\/\//i.test(facebook) ? facebook : `https://facebook.com/${facebook}`,
    })
  }

  const tiktok = trimmed(socials.tiktok)
  if (tiktok) {
    const handle = tiktok.replace(/^@/, "")
    links.push({
      key: "tiktok",
      label: tiktok.startsWith("@") ? tiktok : `@${handle}`,
      href: /^https?:\/\//i.test(tiktok) ? tiktok : `https://tiktok.com/@${handle}`,
    })
  }

  const twitter = trimmed(socials.twitter)
  if (twitter) {
    const handle = twitter.replace(/^@/, "")
    links.push({
      key: "twitter",
      label: twitter.startsWith("@") ? twitter : `@${handle}`,
      href: /^https?:\/\//i.test(twitter) ? twitter : `https://x.com/${handle}`,
    })
  }

  const youtube = trimmed(socials.youtube)
  if (youtube) {
    links.push({
      key: "youtube",
      label: "YouTube",
      href: /^https?:\/\//i.test(youtube) ? youtube : `https://youtube.com/@${youtube}`,
    })
  }

  const whatsapp = trimmed(socials.whatsapp)
  if (whatsapp) {
    links.push({
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`,
    })
  }

  return links
}
