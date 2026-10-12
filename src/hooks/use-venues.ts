"use client"

import { useMemo, useSyncExternalStore } from "react"

import type { Venue } from "@/constants/venues"
import { useSession } from "@/libs/session"
import { STORAGE_EVENT } from "@/libs/storage"
import { venuesServerSnapshot, venuesSnapshot } from "@/libs/venue-store"

function subscribe(listener: () => void): () => void {
  window.addEventListener(STORAGE_EVENT, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(STORAGE_EVENT, listener)
    window.removeEventListener("storage", listener)
  }
}

/**
 * Venues visible to clients: the static records plus professional-created ones,
 * with owner edits applied. Hidden venues are filtered out so callers render
 * only what the marketplace should show.
 */
export function usePublicVenues(): Venue[] {
  const venues = useSyncExternalStore(subscribe, venuesSnapshot, venuesServerSnapshot)
  return useMemo(() => venues.filter((venue) => !venue.hidden), [venues])
}

/** Every merged venue, including hidden ones (used by the owner's workspace). */
export function useAllVenues(): Venue[] {
  return useSyncExternalStore(subscribe, venuesSnapshot, venuesServerSnapshot)
}

/** Venues owned by the signed-in professional, newest custom records last. */
export function useOwnedVenues(): Venue[] {
  const venues = useAllVenues()
  const { user } = useSession()
  const userId = user?.id ?? null
  return useMemo(
    () =>
      userId ? venues.filter((venue) => Boolean(venue.ownerId) && venue.ownerId === userId) : [],
    [venues, userId],
  )
}
