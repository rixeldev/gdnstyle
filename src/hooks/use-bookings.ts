"use client"

import { useCallback } from "react"

import { useStoredList } from "@/hooks/use-stored-list"
import { timeslotEpoch } from "@/utils/date"

const BOOKINGS_KEY = "gdn.bookings"

/**
 * A confirmed client-side booking (test data until the database is wired up).
 * Service/professional names stay as ids so the dashboard can translate them
 * in the active locale.
 */
export interface Booking {
  id: string
  venueId: string
  serviceId: string
  professionalId: string | null
  /** `YYYY-MM-DD`. */
  date: string
  /** `HH:MM`. */
  time: string
  /** Snapshot of the agreed price in DOP. */
  price: number
  createdAt: number
}

function sortByWhen(a: Booking, b: Booking): number {
  return timeslotEpoch(a.date, a.time) - timeslotEpoch(b.date, b.time)
}

export function useBookings() {
  const { items, ready, mutate } = useStoredList<Booking>(BOOKINGS_KEY)

  const add = useCallback(
    (booking: Booking) => {
      mutate((previous) => [...previous, booking])
    },
    [mutate],
  )

  const cancel = useCallback(
    (id: string) => {
      mutate((previous) => previous.filter((booking) => booking.id !== id))
    },
    [mutate],
  )

  // Only read the clock when there is something to classify: during prerender
  // the list is empty, so no "unstable value during prerender" warning fires.
  const now = items.length > 0 ? new Date().getTime() : 0
  const upcoming = items.filter((b) => timeslotEpoch(b.date, b.time) >= now).sort(sortByWhen)
  const past = items
    .filter((b) => timeslotEpoch(b.date, b.time) < now)
    .sort(sortByWhen)
    .reverse()

  return { bookings: items, upcoming, past, ready, add, cancel }
}
