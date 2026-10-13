"use client"

import { adaptVenues } from "@/libs/marketplace/adapt"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { setCatalogVenues } from "@/libs/venue-store"
import { fetchCatalogData } from "@/services/marketplace.service"

let started = false

/**
 * Load the live catalog once per tab and publish it to the venue store. The
 * database replaces the static test records entirely when Supabase is
 * configured; without credentials this is a no-op and the static records stay.
 */
export function ensureCatalogLoaded(): void {
  if (started) return
  const client = getSupabaseBrowserClient()
  if (!client) return

  started = true
  void (async () => {
    try {
      const data = await fetchCatalogData(client)
      setCatalogVenues(adaptVenues(data))
    } catch (error) {
      console.error("[marketplace] failed to load the catalog", error)
      setCatalogVenues([])
    }
  })()
}

/**
 * Re-fetch the catalog after the professional creates or edits a venue. Publishes
 * the fresh rows through the same store, so the directory and detail pages pick
 * the change up without a reload.
 */
export function reloadCatalog(): void {
  started = false
  ensureCatalogLoaded()
}
