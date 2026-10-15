/**
 * Image source policy for `next/image`.
 *
 * Only local paths and Supabase Storage objects are allow-listed in
 * `next.config.ts` (`images.remotePatterns`), so those can go through the
 * optimizer. Marketplace rows also store arbitrary free-text URLs (provider
 * photos, reviewer avatars) on third-party hosts; those must render
 * `unoptimized` or `next/image` throws at render time.
 */

const SUPABASE_HOST = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return null
  try {
    return new URL(raw).hostname
  } catch {
    return null
  }
})()

/** True when `next/image` is allowed to optimize the source. */
export function isOptimizableImage(src: string | undefined): boolean {
  if (!src) return false
  if (src.startsWith("/")) return true
  if (!SUPABASE_HOST) return false
  try {
    return new URL(src).hostname === SUPABASE_HOST
  } catch {
    return false
  }
}
