import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env"

/**
 * Refresh the Supabase session on every request and keep the auth cookies in
 * sync between the browser and the server. Used by the root `proxy.ts`.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  if (!isSupabaseConfigured || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Deliberately no `getUser()` here. Refreshing the token from the proxy
  // races the browser client's own auto-refresh: two JS realms holding the
  // same rotating refresh token, and whoever loses makes the session read as
  // null for a moment — which bounces signed-in visitors between `/dashboard`
  // (no session → login) and `/auth/login` (session → dashboard) until the
  // state settles. The browser client owns refresh; the cookies stay in sync
  // through `getAll`/`setAll` above, and a server component that needs the
  // user calls `auth.getUser()` for its own request.
  return response
}
