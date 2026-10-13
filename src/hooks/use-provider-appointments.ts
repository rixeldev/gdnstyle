"use client"

import { useCallback, useEffect, useState } from "react"

import { type Booking } from "@/hooks/use-bookings"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  appointmentToBooking,
  fetchProviderAppointments,
  setAppointmentStatus,
} from "@/services/appointments.service"
import { timeslotEpoch } from "@/utils/date"

/** Stable empty list so derived values keep the same reference. */
const NO_BOOKINGS: Booking[] = []

function sortByWhen(a: Booking, b: Booking): number {
  return timeslotEpoch(a.date, a.time) - timeslotEpoch(b.date, b.time)
}

/**
 * Appointments booked with the signed-in professional (`appointments` rows whose
 * `provider_id` is theirs). RLS scopes the select to the provider, and the same
 * policy allows moving an appointment between statuses.
 */
export function useProviderAppointments() {
  const supabase = getSupabaseBrowserClient()
  const { user } = useSession()
  const providerId = user?.providerId ?? null
  const [state, setState] = useState<{ providerId: string; rows: Booking[] } | null>(null)

  useEffect(() => {
    if (!supabase || !providerId) return

    let active = true
    void fetchProviderAppointments(supabase, providerId).then((rows) => {
      if (!active) return
      setState({ providerId, rows: rows.map(appointmentToBooking) })
    })

    return () => {
      active = false
    }
  }, [supabase, providerId])

  const bookings = providerId && state?.providerId === providerId ? state.rows : NO_BOOKINGS

  const setStatus = useCallback(
    async (id: string, status: string) => {
      if (!supabase || !providerId) return

      // Optimistic update; reload if the write is rejected.
      setState((current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((row) => (row.id === id ? { ...row, status } : row)),
            }
          : current,
      )

      const ok = await setAppointmentStatus(supabase, id, status)
      if (ok) return

      const rows = await fetchProviderAppointments(supabase, providerId)
      setState({ providerId, rows: rows.map(appointmentToBooking) })
    },
    [supabase, providerId],
  )

  // Only read the clock when there is something to classify (see `useBookings`).
  const now = bookings.length > 0 ? new Date().getTime() : 0
  const upcoming = bookings.filter((b) => timeslotEpoch(b.date, b.time) >= now).sort(sortByWhen)
  const past = bookings
    .filter((b) => timeslotEpoch(b.date, b.time) < now)
    .sort(sortByWhen)
    .reverse()

  return { upcoming, past, setStatus }
}
