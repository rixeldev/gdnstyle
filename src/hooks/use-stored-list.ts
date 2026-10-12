"use client"

import { useCallback, useSyncExternalStore } from "react"

import { useIsClient } from "@/hooks/use-is-client"
import { broadcastStorageChange, readListSnapshot, STORAGE_EVENT, writeList } from "@/libs/storage"

const EMPTY: never[] = []

function subscribe(listener: () => void): () => void {
  window.addEventListener(STORAGE_EVENT, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(STORAGE_EVENT, listener)
    window.removeEventListener("storage", listener)
  }
}

/**
 * Reactive list persisted in localStorage, shared across components (and, via
 * the native `storage` event, across tabs). Built on `useSyncExternalStore`, so
 * the first (hydrating) render uses the server snapshot (empty) and the real
 * data lands right after — no hydration mismatch, no empty-state flash.
 *
 * `ready` is false during SSR/hydration and true once the client snapshot is
 * active, so callers can render a skeleton until then.
 */
export function useStoredList<T>(key: string) {
  const items = useSyncExternalStore(
    subscribe,
    () => readListSnapshot<T>(key),
    () => EMPTY as T[],
  )
  const ready = useIsClient()

  const mutate = useCallback(
    (next: T[] | ((previous: T[]) => T[])) => {
      // Read fresh from storage so sequential updates in the same tick are safe.
      const nextItems = typeof next === "function" ? next(readListSnapshot<T>(key)) : next
      writeList(key, nextItems)
      broadcastStorageChange()
    },
    [key],
  )

  return { items, ready, mutate }
}
