import type { MetadataRoute } from "next"

import { CATEGORIES } from "@/constants/categories"
import { SITE } from "@/constants/site"
import { VENUES, VENUE_CITIES } from "@/constants/venues"
import { slugify } from "@/utils/slug"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/locales`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/favoritos`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE.url}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/policies`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/auth/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/auth/signup`, changeFrequency: "yearly", priority: 0.3 },
  ]

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((category) => ({
    url: `${SITE.url}/locales/categoria/${category.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const cityRoutes: MetadataRoute.Sitemap = VENUE_CITIES.map((city) => ({
    url: `${SITE.url}/locales/ciudad/${slugify(city)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  const venueRoutes: MetadataRoute.Sitemap = VENUES.map((venue) => ({
    url: `${SITE.url}/locales/${venue.id}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  return [...staticRoutes, ...categoryRoutes, ...cityRoutes, ...venueRoutes].map((entry) => ({
    ...entry,
    lastModified: now,
  }))
}
