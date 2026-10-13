"use client"

import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { fetchFavorites } from "@/services/favorites.service"

/**
 * Tab-wide cache of the signed-in user's favourites. The `useFavorites` hook is
 * mounted in several places (venue cards, header count, saved page), so the
 * database result is loaded once and shared through this store instead of every
 * instance fetching on its own.
 */
export interface FavoritesState {
  /** The account the loaded ids belong to, or `null` before/without a session. */
  userId: string | null
  ids: string[]
  loading: boolean
}

const EMPTY_IDS: string[] = []
const SERVER_STATE: FavoritesState = { userId: null, ids: EMPTY_IDS, loading: false }

let state: FavoritesState = SERVER_STATE
let loadingFor: string | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function favoritesState(): FavoritesState {
  return state
}

/** Stable empty snapshot used during SSR and hydration. */
export function favoritesServerState(): FavoritesState {
  return SERVER_STATE
}

export function subscribeFavorites(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Load an account's favourites once (pass `force` to refetch). Concurrent calls
 * for the same account share the in-flight request.
 */
export function ensureFavoritesLoaded(userId: string, force = false): void {
  if (!force) {
    if (state.userId === userId && !state.loading) return
    if (loadingFor === userId) return
  }

  const supabase = getSupabaseBrowserClient()
  if (!supabase) return

  loadingFor = userId
  state = { userId, ids: state.userId === userId ? state.ids : EMPTY_IDS, loading: true }
  emit()

  void fetchFavorites(supabase, userId).then((ids) => {
    loadingFor = null
    // Ignore a response that lands after a sign-out or an account switch.
    if (state.userId !== userId) return
    state = { userId, ids, loading: false }
    emit()
  })
}

/** Cache the optimistic list produced by a toggle. */
export function setFavoriteIds(userId: string, ids: string[]): void {
  loadingFor = null
  state = { userId, ids, loading: false }
  emit()
}

/** Forget the cached favourites (sign-out). */
export function clearFavorites(): void {
  if (state.userId === null && state.ids.length === 0) return
  loadingFor = null
  state = SERVER_STATE
  emit()
}
