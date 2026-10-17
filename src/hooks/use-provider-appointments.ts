"use client"

import { useCallback, useEffect, useState } from "react"

import { type Booking } from "@/hooks/use-bookings"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  appointmentToBooking,
  cancelAppointmentByProvider,
  confirmAppointment,
  fetchProviderAppointments,
  rejectRefundRequest,
} from "@/services/appointments.service"
import { processRefund } from "@/services/payments.service"
import { appointmentDisplayStatus, isHistoryBooking } from "@/utils/appointment-status"
import { timeslotEpoch } from "@/utils/date"

/** Stable empty list so derived values keep the same reference. */
const NO_BOOKINGS: Booking[] = []

function sortByWhen(a: Booking, b: Booking): number {
  return timeslotEpoch(a.date, a.time, a.timeZone) - timeslotEpoch(b.date, b.time, b.timeZone)
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

  /** Confirm the booking and release its pending payment. */
  const confirmBooking = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase || !providerId) return false

      const updated = await confirmAppointment(supabase, id)
      if (!updated) return false

      const next = appointmentToBooking(updated)
      setState((current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((row) => (row.id === id ? { ...row, ...next } : row)),
            }
          : current,
      )
      return true
    },
    [supabase, providerId],
  )

  /**
   * Resolve a client's refund request: `approved` runs the Stripe refund via
   * the `process-refund` function, `rejected` only closes the request.
   */
  const resolveRefund = useCallback(
    async (id: string, resolution: "approved" | "rejected"): Promise<boolean> => {
      if (!supabase || !providerId) return false

      // Approving must run through `process-refund` (it reverses the Stripe
      // transfer); rejecting tries the same function first (consistent state)
      // and falls back to the direct RLS update if it is not deployed yet.
      const ok =
        resolution === "approved"
          ? await processRefund(id, "approve").then(
              () => true,
              () => false,
            )
          : await processRefund(id, "reject").then(
              () => true,
              () => rejectRefundRequest(supabase, id),
            )

      if (ok) {
        setState((current) =>
          current
            ? {
                ...current,
                rows: current.rows.map((row) =>
                  row.id === id
                    ? {
                        ...row,
                        refundStatus: resolution,
                        paymentStatus: resolution === "approved" ? "refunded" : row.paymentStatus,
                      }
                    : row,
                ),
              }
            : current,
        )
      }

      return ok
    },
    [supabase, providerId],
  )

  /**
   * Cancel from the professional side, always recording the reason so the
   * client sees why their appointment was refused.
   */
  const cancelBooking = useCallback(
    async (id: string, reason?: string): Promise<boolean> => {
      if (!supabase || !providerId) return false

      const cancelled = await cancelAppointmentByProvider(supabase, id, reason)
      if (!cancelled) return false

      setState((current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((row) =>
                row.id === id
                  ? {
                      ...row,
                      status: "cancelled",
                      cancellationReason: reason?.trim() || row.cancellationReason,
                    }
                  : row,
              ),
            }
          : current,
      )
      return true
    },
    [supabase, providerId],
  )

  // Only read the clock when there is something to classify (see `useBookings`).
  const now = bookings.length > 0 ? new Date().getTime() : 0
  // Status as displayed: `overdue` is derived for pending rows whose hour is
  // already over, and legacy `completed` rows read as confirmed.
  const withStatus = bookings.map((booking) => ({
    ...booking,
    displayStatus: appointmentDisplayStatus(booking, now),
  }))
  // Same rule as the client dashboard (see `isHistoryBooking`): overdue stays
  // active so the professional can still confirm it late.
  const isPast = (b: Booking) =>
    isHistoryBooking(b.displayStatus ?? "pending", b.date, b.time, now, b.timeZone)

  const upcoming = withStatus.filter((b) => !isPast(b)).sort(sortByWhen)
  const past = withStatus.filter(isPast).sort(sortByWhen).reverse()

  // Cancelled rows with an open refund request need the professional's eyes.
  const refundRequests = withStatus.filter(
    (b) => b.displayStatus === "cancelled" && b.refundStatus === "requested",
  )

  return { upcoming, past, refundRequests, confirmBooking, resolveRefund, cancelBooking }
}
