"use client"

import { useMemo, useSyncExternalStore } from "react"

import type { Venue } from "@/constants/venues"
import { useProviderVenueLinks } from "@/hooks/use-provider-links"
import { ensureCatalogLoaded } from "@/libs/marketplace/loader"
import { useSession } from "@/libs/session"
import { STORAGE_EVENT } from "@/libs/storage"
import { catalogReady, venuesServerSnapshot, venuesSnapshot } from "@/libs/venue-store"

function subscribe(listener: () => void): () => void {
  // Load the live catalog the first time a venue list mounts. The loader is a
  // no-op when Supabase is not configured or the catalog is already cached.
  ensureCatalogLoaded()
  window.addEventListener(STORAGE_EVENT, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(STORAGE_EVENT, listener)
    window.removeEventListener("storage", listener)
  }
}

/**
 * Venues visible to clients. With Supabase configured this is the live catalog
 * built from `locations`/`providers`; otherwise it is the static test records
 * plus professional-created ones, with owner edits applied. Hidden venues are
 * filtered out so callers render only what the marketplace should show.
 */
export function usePublicVenues(): Venue[] {
  const venues = useSyncExternalStore(subscribe, venuesSnapshot, venuesServerSnapshot)
  return useMemo(() => venues.filter((venue) => !venue.hidden), [venues])
}

/** Every merged venue, hidden ones included (dashboard and detail previews). */
export function useAllVenues(): Venue[] {
  return useSyncExternalStore(subscribe, venuesSnapshot, venuesServerSnapshot)
}

/** Venues owned by the signed-in professional. */
export function useOwnedVenues(): Venue[] {
  const venues = useAllVenues()
  const { user } = useSession()
  const { links } = useProviderVenueLinks()
  return useMemo(() => {
    // Database professionals own the locations linked to their providers row.
    if (user?.providerId) {
      const owned = new Set(links.map((link) => link.location_id))
      return venues.filter((venue) => owned.has(venue.id))
    }
    return user ? venues.filter((venue) => venue.ownerId === user.id) : []
  }, [venues, user, links])
}

/** `true` once the live catalog has loaded (always `true` without Supabase). */
export function useCatalogReady(): boolean {
  return useSyncExternalStore(subscribe, catalogReady, () => true)
}
