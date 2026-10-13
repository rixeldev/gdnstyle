"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"

import { useStoredList } from "@/hooks/use-stored-list"
import {
  clearFavorites,
  ensureFavoritesLoaded,
  favoritesServerState,
  favoritesState,
  setFavoriteIds,
  subscribeFavorites,
} from "@/libs/favorites-store"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { addFavorite, removeFavorite } from "@/services/favorites.service"

const FAVORITES_KEY = "gdn.favorites"

/**
 * Saved venue ids. With Supabase configured the ids live in the `favorites`
 * table (shared across the tab through `favorites-store`); without credentials
 * they stay in localStorage as the demo fallback. Both paths expose the same
 * `{ favorites, ready, count, isFavorite, toggle }` shape.
 */
export function useFavorites() {
  const supabase = getSupabaseBrowserClient()
  const { ready: sessionReady, user } = useSession()
  const { items: localItems, ready: localReady, mutate } = useStoredList<string>(FAVORITES_KEY)
  const cloud = Boolean(supabase)
  const userId = user?.id ?? null

  useEffect(() => {
    if (!cloud || !sessionReady) return
    if (userId) ensureFavoritesLoaded(userId)
    else clearFavorites()
  }, [cloud, sessionReady, userId])

  const remote = useSyncExternalStore(subscribeFavorites, favoritesState, favoritesServerState)

  const items = cloud ? remote.ids : localItems
  const ready = cloud
    ? sessionReady && (!userId || (!remote.loading && remote.userId === userId))
    : localReady

  const isFavorite = useCallback((id: string) => items.includes(id), [items])

  const toggle = useCallback(
    (id: string) => {
      const active = items.includes(id)

      if (cloud && supabase && userId) {
        // Optimistic: the shared store updates every mounted heart/count, and
        // the write happens in the background.
        const next = active ? items.filter((item) => item !== id) : [...items, id]
        setFavoriteIds(userId, next)
        void (
          active ? removeFavorite(supabase, userId, id) : addFavorite(supabase, userId, id)
        ).then((ok) => {
          // Reload from the database when the write failed.
          if (!ok) ensureFavoritesLoaded(userId, true)
        })
        return
      }

      mutate((previous) =>
        previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
      )
    },
    [cloud, supabase, userId, items, mutate],
  )

  return { favorites: items, ready, count: items.length, isFavorite, toggle }
}
