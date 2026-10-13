import type { NextConfig } from "next"

/**
 * Marketplace photos live in the Supabase Storage `portfolio` bucket
 * (`.../storage/v1/object/public/...`), so `next/image` needs that host
 * allow-listed. Derived from the public project URL; when Supabase is not
 * configured the list stays empty and local `/venues` images keep working.
 */
function supabaseImageHosts(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return []

  try {
    return [
      {
        protocol: "https",
        hostname: new URL(raw).hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ]
  } catch {
    return []
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseImageHosts(),
  },
  cacheComponents: true,
  partialPrefetching: true,
  /**
   * The marketplace routes used to be Spanish (`/locales`, `/favoritos`, …).
   * Keep the old public paths working with permanent redirects to the English
   * routes, so shared links and search results don't 404.
   */
  async redirects() {
    return [
      { source: "/locales", destination: "/venues", permanent: true },
      {
        source: "/locales/categoria/:slug",
        destination: "/venues/category/:slug",
        permanent: true,
      },
      { source: "/locales/ciudad/:slug", destination: "/venues/city/:slug", permanent: true },
      { source: "/locales/:id", destination: "/venues/:id", permanent: true },
      { source: "/favoritos", destination: "/favorites", permanent: true },
    ]
  },
  /** Allow the dev-only HMR socket when previewing through an ngrok tunnel. */
  allowedDevOrigins: ["*.ngrok-free.dev"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
