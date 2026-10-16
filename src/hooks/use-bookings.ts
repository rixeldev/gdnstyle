"use client"

import { useCallback, useEffect, useState } from "react"

import { useStoredList } from "@/hooks/use-stored-list"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  appointmentToBooking,
  ChangeWindowClosedError,
  createAppointment,
  fetchClientAppointments,
  requestAppointmentCancellation,
  rescheduleAppointment,
  type CancellationOutcome,
} from "@/services/appointments.service"
import { timeslotEpoch } from "@/utils/date"
import {
  appointmentDisplayStatus,
  canClientModify,
  isHistoryBooking,
  type AppointmentDisplayStatus,
} from "@/utils/appointment-status"

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
  /** Snapshot of the agreed price in USD. */
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
  /** Payment lifecycle: pending (awaiting the professional) → released → refunded. */
  paymentStatus?: string
  /** Refund request state: requested / approved / rejected. */
  refundStatus?: string
  refundReason?: string
  /** Why the appointment was cancelled, when someone cancelled it. */
  cancellationReason?: string
  /**
   * Status as shown in the UI, derived from the clock at read time. `overdue`
   * is never stored: it only appears for a pending appointment whose slot has
   * already ended.
   */
  displayStatus?: AppointmentDisplayStatus
  /**
   * Whether the client may still act on this booking, resolved with the same
   * clock snapshot as `displayStatus`. `false` inside the 1h30m window, where
   * the appointment can be neither edited nor cancelled.
   */
  canModify?: boolean
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

  // Resolved before the mutations below: both `cancel` and `reschedule` need
  // the current list to apply the 1h30m lock to the booking being changed.
  const remoteReady = clientId ? loadedFor === clientId : sessionReady
  const remoteItems = clientId && loadedFor === clientId ? remote : NO_BOOKINGS
  const items = cloud ? remoteItems : localItems
  const ready = cloud ? sessionReady && remoteReady : localReady

  const cancel = useCallback(
    async (id: string, reason?: string): Promise<CancellationOutcome> => {
      // The database path enforces the lock inside the service; local demo
      // records have no row to inspect, so the same rule is applied here.
      const target = items.find((booking) => booking.id === id)
      if (target && !canClientModify(target, Date.now())) return "too-late"

      if (cloud && supabase && clientId) {
        // Paid appointments stay in history (status `cancelled` + refund
        // request); free/demo ones are removed outright.
        const outcome = await requestAppointmentCancellation(supabase, id, reason)
        if (!outcome) return null
        if (outcome === "too-late") return "too-late"
        setRemote((previous) =>
          previous.map((booking) =>
            booking.id === id
              ? {
                  ...booking,
                  status: "cancelled",
                  cancellationReason: reason?.trim() || booking.cancellationReason,
                  // Only money-backed cancellations open a refund request.
                  refundStatus: outcome === "refund-requested" ? "requested" : booking.refundStatus,
                }
              : booking,
          ),
        )
        return outcome
      }
      mutate((previous) => previous.filter((booking) => booking.id !== id))
      return "cancelled"
    },
    [cloud, supabase, clientId, mutate, items],
  )

  /**
   * Move a booking to another day/time from the dashboard.
   *
   * Database rows are re-validated against real availability (and against the
   * lock window) by `rescheduleAppointment`, which throws when either rule is
   * broken; local demo records are rewritten in place so both kinds of booking
   * behave the same for the reader.
   */
  const reschedule = useCallback(
    async (id: string, date: string, time: string): Promise<Booking | null> => {
      const target = items.find((booking) => booking.id === id)
      if (!target) return null
      if (!canClientModify(target, Date.now())) throw new ChangeWindowClosedError()

      if (cloud && supabase && clientId && target.database) {
        const updated = await rescheduleAppointment(supabase, {
          id,
          providerId: target.professionalId,
          currentDate: target.date,
          currentTime: target.time,
          date,
          time,
          durationMinutes: target.durationMinutes ?? 30,
        })
        if (!updated) return null

        const saved = appointmentToBooking(updated)
        setRemote((previous) => previous.map((booking) => (booking.id === id ? saved : booking)))
        return saved
      }

      const saved = { ...target, date, time }
      mutate((previous) => previous.map((booking) => (booking.id === id ? saved : booking)))
      return saved
    },
    [cloud, supabase, clientId, mutate, items],
  )

  // Only read the clock when there is something to classify: during prerender
  // the list is empty, so no "unstable value during prerender" warning fires.
  const now = items.length > 0 ? new Date().getTime() : 0
  // Every booking carries the status the UI shows. `overdue` comes from the
  // clock alone — a pending appointment whose slot is over reads as atrasada
  // without anything being written to the database.
  const withStatus = items.map((booking) => ({
    ...booking,
    displayStatus: appointmentDisplayStatus(booking, now),
    // The 1h30m window the client still has to edit or cancel, resolved with
    // the same clock snapshot as the status above so a row never shows two
    // different "now"s.
    canModify: canClientModify(booking, now),
  }))
  // An overdue booking is still unresolved (nobody confirmed it), so
  // `isHistoryBooking` keeps it in the active list where both sides can act
  // instead of quietly moving it to history.
  const isPast = (b: Booking) => isHistoryBooking(b.displayStatus ?? "pending", b.date, b.time, now)

  const upcoming = withStatus.filter((b) => !isPast(b)).sort(sortByWhen)
  const past = withStatus.filter(isPast).sort(sortByWhen).reverse()

  return { bookings: withStatus, upcoming, past, ready, add, cancel, reschedule }
}
