"use client"

import { useCallback, useEffect, useState } from "react"

import { useStoredList } from "@/hooks/use-stored-list"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  appointmentToBooking,
  cancelAppointment,
  createAppointment,
  fetchClientAppointments,
} from "@/services/appointments.service"
import { timeslotEpoch } from "@/utils/date"

const BOOKINGS_KEY = "gdn.bookings"

/** Stable empty list so derived values keep the same reference. */
const NO_BOOKINGS: Booking[] = []

/**
 * A client booking. With Supabase configured the record comes from the
 * `appointments` table; without credentials it is a local test record. The
 * database-only fields are `undefined` for local records.
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
  /** Raw service label stored with a database booking (skips the i18n table). */
  serviceName?: string
  /** Provider display name for database bookings the static pool does not know. */
  professionalName?: string
  durationMinutes?: number
  status?: string
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  /** True when `id` is an `appointments` uuid (database-backed booking). */
  database?: boolean
}

function sortByWhen(a: Booking, b: Booking): number {
  return timeslotEpoch(a.date, a.time) - timeslotEpoch(b.date, b.time)
}

/** Digits-only number for the `numeric` `client_phone` column (null when absent). */
function phoneToNumber(phone: string | null | undefined): number | null {
  const digits = phone?.replace(/\D/g, "")
  if (!digits) return null
  const value = Number(digits)
  return Number.isFinite(value) ? value : null
}

/**
 * Bookings for the signed-in visitor. Reads from `appointments` and writes
 * there when Supabase is configured; otherwise it keeps the local demo list.
 * Both paths expose the same shape so the dashboard/booking UI is unchanged.
 */
export function useBookings() {
  const supabase = getSupabaseBrowserClient()
  const { ready: sessionReady, user } = useSession()
  const { items: localItems, ready: localReady, mutate } = useStoredList<Booking>(BOOKINGS_KEY)
  const [remote, setRemote] = useState<Booking[]>(NO_BOOKINGS)
  // Which account the loaded rows belong to, so a sign-out/switch never shows
  // another visitor's bookings while the new fetch is in flight.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const cloud = Boolean(supabase)
  const clientId = user?.id ?? null

  useEffect(() => {
    if (!cloud || !supabase || !clientId) return

    let active = true
    void fetchClientAppointments(supabase, clientId).then((rows) => {
      if (!active) return
      setRemote(rows.map(appointmentToBooking))
      setLoadedFor(clientId)
    })

    return () => {
      active = false
    }
  }, [cloud, supabase, clientId])

  const add = useCallback(
    async (booking: Booking): Promise<Booking> => {
      // Database bookings need a real provider/location uuid, so only records
      // adapted from the live catalog are written to `appointments`.
      if (cloud && supabase && clientId && booking.database && booking.professionalId) {
        const created = await createAppointment(supabase, {
          clientId,
          providerId: booking.professionalId,
          locationId: booking.venueId,
          serviceId: booking.serviceId,
          serviceName: booking.serviceName ?? null,
          date: booking.date,
          time: booking.time,
          durationMinutes: booking.durationMinutes ?? 30,
          price: booking.price,
          clientName: booking.clientName ?? null,
          clientEmail: booking.clientEmail ?? null,
          clientPhone: phoneToNumber(booking.clientPhone),
        })
        if (!created) throw new Error("appointment-create-failed")

        const saved = appointmentToBooking(created)
        setRemote((previous) => [...previous, saved])
        setLoadedFor(clientId)
        return saved
      }

      mutate((previous) => [...previous, booking])
      return booking
    },
    [cloud, supabase, clientId, mutate],
  )

  const cancel = useCallback(
    async (id: string) => {
      if (cloud && supabase && clientId) {
        setRemote((previous) => previous.filter((booking) => booking.id !== id))
        await cancelAppointment(supabase, id)
        return
      }
      mutate((previous) => previous.filter((booking) => booking.id !== id))
    },
    [cloud, supabase, clientId, mutate],
  )

  const remoteReady = clientId ? loadedFor === clientId : sessionReady
  const remoteItems = clientId && loadedFor === clientId ? remote : NO_BOOKINGS
  const items = cloud ? remoteItems : localItems
  const ready = cloud ? sessionReady && remoteReady : localReady

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
