import type { NextRequest } from "next/server"

import { updateSession } from "@/libs/supabase/proxy"

/** Next.js 16 replaces `middleware` with `proxy`. */
export async function proxy(request: NextRequest) {
  return updateSession(request)
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
