"use client"

import { useSyncExternalStore } from "react"

/** Nothing to subscribe to: hydration happens once and never notifies. */
const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

/**
 * `false` on the server and during hydration, `true` once the client snapshot
 * is active. Use it to gate client-only markup without an effect + setState.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
