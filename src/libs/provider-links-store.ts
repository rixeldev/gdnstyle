"use client"

import type { DbProviderLocation } from "@/interfaces/marketplace"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { fetchProviderLocations } from "@/services/provider.service"

/**
 * Tab-wide cache of the signed-in professional's `provider_locations`. The
 * dashboard and the venue dialog both read it, and creating/editing a venue
 * invalidates it so the owned list refreshes without a page reload.
 */
export interface ProviderLinksState {
  /** The provider the loaded links belong to, or `null` before/without one. */
  providerId: string | null
  links: DbProviderLocation[]
  loading: boolean
}

const NO_LINKS: DbProviderLocation[] = []
const SERVER_STATE: ProviderLinksState = { providerId: null, links: NO_LINKS, loading: false }

let state: ProviderLinksState = SERVER_STATE
let loadingFor: string | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function providerLinksState(): ProviderLinksState {
  return state
}

/** Stable empty snapshot used during SSR and hydration. */
export function providerLinksServerState(): ProviderLinksState {
  return SERVER_STATE
}

export function subscribeProviderLinks(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Load a provider's linked venues once (pass `force` to refetch). Concurrent
 * calls for the same provider share the in-flight request.
 */
export function ensureProviderLinks(providerId: string, force = false): void {
  if (!force) {
    if (state.providerId === providerId && !state.loading) return
    if (loadingFor === providerId) return
  }

  const supabase = getSupabaseBrowserClient()
  if (!supabase) return

  loadingFor = providerId
  state = {
    providerId,
    links: state.providerId === providerId ? state.links : NO_LINKS,
    loading: true,
  }
  emit()

  void fetchProviderLocations(supabase, providerId).then((links) => {
    loadingFor = null
    // Ignore a response that lands after a sign-out or a provider switch.
    if (state.providerId !== providerId) return
    state = { providerId, links, loading: false }
    emit()
  })
}

/** Refetch the current provider's links (after creating or editing a venue). */
export function invalidateProviderLinks(): void {
  if (!state.providerId) return
  ensureProviderLinks(state.providerId, true)
}

/** Drop the cached links on sign-out. */
export function clearProviderLinks(): void {
  if (state.providerId === null && state.links.length === 0) return
  loadingFor = null
  state = SERVER_STATE
  emit()
}
