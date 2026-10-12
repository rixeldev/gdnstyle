"use client"

import { useCallback } from "react"

import { useStoredList } from "@/hooks/use-stored-list"

const FAVORITES_KEY = "gdn.favorites"

/** Venue ids saved by the visitor, persisted locally until the account exists. */
export function useFavorites() {
  const { items: favorites, ready, mutate } = useStoredList<string>(FAVORITES_KEY)

  const isFavorite = useCallback((venueId: string) => favorites.includes(venueId), [favorites])

  /**
   * Toggle a venue id and return the new state (`true` = now a favorite), so
   * callers can fire the matching toast/announcement synchronously.
   */
  const toggle = useCallback(
    (venueId: string): boolean => {
      let added = false
      mutate((previous) => {
        added = !previous.includes(venueId)
        return added ? [...previous, venueId] : previous.filter((id) => id !== venueId)
      })
      return added
    },
    [mutate],
  )

  return { favorites, count: favorites.length, ready, isFavorite, toggle }
}
