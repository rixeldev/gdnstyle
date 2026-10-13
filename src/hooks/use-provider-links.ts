"use client"

import { useEffect, useSyncExternalStore } from "react"

import type { DbProviderLocation } from "@/interfaces/marketplace"
import {
  clearProviderLinks,
  ensureProviderLinks,
  providerLinksServerState,
  providerLinksState,
  subscribeProviderLinks,
} from "@/libs/provider-links-store"
import { useSession } from "@/libs/session"

const NO_LINKS: DbProviderLocation[] = []

/**
 * The `provider_locations` rows that belong to the signed-in professional.
 * Resolves which database venues they own and carries the link id/category the
 * edit dialog writes back to. Read through a shared store so the dashboard and
 * the dialog stay in sync after a venue is created or edited.
 */
export function useProviderVenueLinks(): { links: DbProviderLocation[] } {
  const { ready, user } = useSession()
  const providerId = user?.providerId ?? null

  useEffect(() => {
    if (!ready) return
    if (providerId) ensureProviderLinks(providerId)
    else clearProviderLinks()
  }, [ready, providerId])

  const remote = useSyncExternalStore(
    subscribeProviderLinks,
    providerLinksState,
    providerLinksServerState,
  )

  // Only expose links that belong to the current provider, so switching
  // accounts never shows stale venues while the new fetch is in flight.
  const links = providerId && remote.providerId === providerId ? remote.links : NO_LINKS
  return { links }
}
