import type { NextConfig } from "next"

/**
 * Static security headers, applied to every response.
 *
 * The Content-Security-Policy is not here: it carries a per-request nonce, so
 * it is minted in `src/proxy.ts` (see `src/libs/security/csp.ts` for the
 * policy itself). Everything below is a fixed value with no per-request work.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app embeds no map controls outside its own pages; nothing here needs
  // geolocation, camera or microphone either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), usb=()",
  },
  // Browsers ignore this over http:// (local dev), and it does not pin
  // subdomains, so the staging project cannot lock out its own operators.
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
]

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
  /**
   * Same header set on every route. The value is built once at load, so this
   * adds no per-request work beyond Next writing the lines out.
   */
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  /** Do not advertise the framework version in `X-Powered-By`. */
  poweredByHeader: false,
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
