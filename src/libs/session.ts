"use client"

import { useEffect, useState } from "react"

import { getSupabaseBrowserClient } from "@/libs/supabase/client"

/**
 * True when a signed-in session exists, or when auth is not wired up yet
 * (test-data mode: flows proceed without an account).
 */
export async function hasSession(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return true
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

/**
 * Client-side hook around `hasSession` for components that need to branch
 * between the booking flow and a sign-in call-to-action.
 */
export function useBookingAccess() {
  const [state, setState] = useState<{ ready: boolean; allowed: boolean }>({
    ready: false,
    allowed: false,
  })

  useEffect(() => {
    let active = true
    void hasSession().then((allowed) => {
      if (active) setState({ ready: true, allowed })
    })
    return () => {
      active = false
    }
  }, [])

  return state
}
