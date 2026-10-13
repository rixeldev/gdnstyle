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
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  images: {
    remotePatterns: supabaseImageHosts(),
  },
  cacheComponents: true,
  partialPrefetching: true,
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
