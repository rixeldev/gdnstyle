import { SUPABASE_URL } from "@/libs/supabase/env"

/**
 * Content-Security-Policy for every HTML response, minted per request by the
 * root `proxy.ts` (the header cannot live in `next.config.ts` anymore: a nonce
 * is a per-request value, and Next applies it to its own framework scripts,
 * bundles and inline flight payload only when the request carries one).
 *
 * That automatic application is also why every route renders per request —
 * Next's guide states it plainly: with a nonce, static prerendering is
 * impossible, because a page built at build time has no request to carry a
 * nonce and its inline scripts would be blocked by this very header.
 *
 * The policy keeps 'unsafe-inline' in `style-src` on purpose: framer-motion
 * and the booking form set `style` attributes, and a nonce or hash only covers
 * `<style>` elements, never attributes.
 */
export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    // Scripts injected by an already-trusted script (the router's chunks,
    // Stripe.js) are allowed without listing them; 'self' and the host
    // allow-list stay as the fallback for browsers without CSP3 support.
    "'strict-dynamic'",
    // Turbopack's HMR evaluates modules; never present in production.
    ...(dev ? ["'unsafe-eval'"] : []),
    "https://js.stripe.com",
    "https://m.stripe.network",
    "https://va.vercel-scripts.com",
  ]

  const connect = [
    "'self'",
    // Realtime subscribes over wss:// on the project host.
    ...supabaseApiOrigins(),
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
    "upgrade-insecure-requests",
  ].join("; ")
}

/** A fresh nonce for one request; base64 so it is CSP-header safe. */
export function mintNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
}

/**
 * `https://` and `wss://` forms of the Supabase project host, for the CSP's
 * `connect-src`: REST and functions answer over https, Realtime over wss.
 * Empty until Supabase is configured.
 */
function supabaseApiOrigins(): string[] {
  if (!SUPABASE_URL) return []

  try {
    const host = new URL(SUPABASE_URL).host
    return [`https://${host}`, `wss://${host}`]
  } catch {
    return []
  }
}
