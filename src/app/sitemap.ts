import type { MetadataRoute } from "next"

import { ALL_CATEGORIES } from "@/constants/categories"
import { SITE } from "@/constants/site"
import { catalogCities, getServerCatalog } from "@/libs/marketplace/server"
import { slugify } from "@/utils/slug"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const venues = await getServerCatalog()
  const cities = catalogCities(venues)

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

  const categoryRoutes: MetadataRoute.Sitemap = ALL_CATEGORIES.map((category) => ({
    url: `${SITE.url}/locales/categoria/${category.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${SITE.url}/locales/ciudad/${slugify(city)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  const venueRoutes: MetadataRoute.Sitemap = venues.map((venue) => ({
    url: `${SITE.url}/locales/${venue.id}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  return [...staticRoutes, ...categoryRoutes, ...cityRoutes, ...venueRoutes].map((entry) => ({
    ...entry,
    lastModified: now,
  }))
}
