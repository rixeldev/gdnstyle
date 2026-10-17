import type { NextRequest } from "next/server"

import { contentSecurityPolicy, mintNonce } from "@/libs/security/csp"
import { updateSession } from "@/libs/supabase/proxy"

/**
 * Next.js 16 replaces `middleware` with `proxy`.
 *
 * Beyond refreshing the auth session, this is where every response gets its
 * Content-Security-Policy: a fresh nonce per request, written into the request
 * (so Next extracts it while rendering and stamps it on its own framework
 * scripts, bundles and inline flight payload — see `src/app/layout.tsx`,
 * whose `connection()` is what keeps every route dynamically rendered for
 * that to happen) and into the response the browser enforces.
 */
export async function proxy(request: NextRequest) {
  const nonce = mintNonce()
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV !== "production")

  request.headers.set("content-security-policy", csp)
  request.headers.set("x-nonce", nonce)

  const response = await updateSession(request)
  response.headers.set("content-security-policy", csp)

  return response
}

export const config = {
  matcher: [
    /*
     * Run on everything except Next internals and static image assets so the
     * auth session stays fresh across navigation.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
}
