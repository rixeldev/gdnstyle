"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useSession } from "@/libs/session"

/**
 * Keeps signed-in visitors out of the auth screens. Both roles share
 * `/dashboard` (the role split happens inside the panel), so the redirect
 * target never needs the role. Returns `true` while the redirect is pending
 * so the form can hold its first paint instead of flashing.
 */
export function useAuthedRedirect(target = "/dashboard"): boolean {
  const router = useRouter()
  const { ready, authenticated } = useSession()

  useEffect(() => {
    if (ready && authenticated) router.replace(target)
  }, [ready, authenticated, target, router])

  return ready && authenticated
}
