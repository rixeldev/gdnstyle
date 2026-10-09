import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseServerClient } from "@/libs/supabase/server"

/**
 * Exchanges the one-time code from Supabase email links (sign-up confirmation
 * and password recovery) for a session, then forwards the user on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const requestedNext = searchParams.get("next") ?? "/dashboard"
  // Only allow internal redirects to avoid open-redirect abuse.
  const next = requestedNext.startsWith("/") ? requestedNext : "/dashboard"

  if (code) {
    const supabase = await createSupabaseServerClient()
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth`)
}
