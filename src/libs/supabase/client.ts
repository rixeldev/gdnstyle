"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env"

let browserClient: SupabaseClient | null = null

/**
 * Reuse a single browser client for the lifetime of the tab. Returns `null`
 * when the project is not configured so callers can render a safe state
 * instead of throwing.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }

  return browserClient
}
