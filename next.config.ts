import type { NextConfig } from "next"

/**
 * Security headers, applied to every response.
 *
 * The CSP is a baseline: it cannot carry per-request nonces (there is no
 * per-request proxy here to mint them, and Next injects its bootstrap inline),
 * so `script-src` keeps 'unsafe-inline'. What it does buy is the half that an
 * inline style cannot undo — no script loads from a domain that was never
 * audited, no framing, no plugin content, and a tight list of where bytes may
 * be posted to.
 */
function contentSecurityPolicy(): string {
  const dev = process.env.NODE_ENV !== "production"
  const supabase = supabaseApiOrigins()

  const script = [
    "'self'",
    "'unsafe-inline'",
    // Dev only: Turbopack's HMR runs through eval.
    ...(dev ? ["'unsafe-eval'"] : []),
    "https://js.stripe.com",
    "https://m.stripe.network",
    "https://va.vercel-scripts.com",
  ]

  const connect = [
    "'self'",
    // Realtime subscribes over wss:// on the project host.
    ...supabase,
    "https://api.stripe.com",
    "https://r.stripe.com",
    "https://m.stripe.network",
    "https://*.vercel-analytics.com",
    "https://vitals.vercel-insights.com",
  ]

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${script.join(" ")}`,
    // Tailwind emits a stylesheet, but framer-motion and the booking form set
    // style attributes inline.
    "style-src 'self' 'unsafe-inline'",
    // Marketplace photos come from Storage, avatars and map tiles from any
    // https host, and a few images are built as data:/blob: URIs.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' https:",
    `connect-src ${connect.join(" ")}`,
    // The Payment Element, its fraud frame and hosted checkout pages.
    "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "worker-src 'self' blob:",
  ].join("; ")
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
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

/**
 * `https://` and `wss://` forms of the Supabase project host, for the CSP's
 * `connect-src`: REST and functions answer over https, Realtime over wss.
 * Empty until Supabase is configured.
 */
function supabaseApiOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return []

  try {
    const host = new URL(raw).host
    return [`https://${host}`, `wss://${host}`]
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
