import type { MetadataRoute } from "next"

import { SITE } from "@/constants/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes = [
    { url: SITE.url, priority: 1 },
    { url: `${SITE.url}/locales`, priority: 0.8 },
    { url: `${SITE.url}/faq`, priority: 0.6 },
    { url: `${SITE.url}/policies`, priority: 0.3 },
    { url: `${SITE.url}/terms`, priority: 0.3 },
    { url: `${SITE.url}/auth/login`, priority: 0.5 },
    { url: `${SITE.url}/auth/signup`, priority: 0.5 },
  ]

  return staticRoutes.map((route) => ({
    url: route.url,
    lastModified: now,
    changeFrequency: "monthly",
    priority: route.priority,
  }))
}
