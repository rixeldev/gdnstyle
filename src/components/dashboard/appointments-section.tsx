"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { AppointmentStatusBadge } from "@/components/dashboard/appointment-status-badge"
import {
  BookingRowActions,
  CustomerCancelDialog,
} from "@/components/dashboard/customer-cancel-dialog"
import { RescheduleDialog } from "@/components/dashboard/reschedule-dialog"
import { Button, ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { getProfessionalById } from "@/constants/professionals"
import { useAllVenues } from "@/hooks/use-venues"
import { type Booking, useBookings } from "@/hooks/use-bookings"
import { parseDateKey } from "@/utils/date"
import { formatCurrency, formatDate, formatTime, toIntlLocale } from "@/utils/format"

/** Rows shown before the history list asks for more. */
const HISTORY_PAGE = 3

/** Customer dashboard block: real local bookings plus history and cancel. */
export function AppointmentsSection() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const venues = useAllVenues()
  const { upcoming, past, ready, cancel, reschedule } = useBookings()
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null)
  const [pendingEdit, setPendingEdit] = useState<Booking | null>(null)
  const [visibleHistory, setVisibleHistory] = useState(HISTORY_PAGE)

  /** Small status pill for the payment/refund lifecycle of a booking. */
  function lifecycleBadge(booking: Booking) {
    const payment = (booking.paymentStatus ?? "").toLowerCase()
    const refund = (booking.refundStatus ?? "").toLowerCase()

    const pills: { key: string; className: string }[] = []
    if (payment === "pending")
      pills.push({ key: "paymentPending", className: "border-gold/30 bg-gold/10 text-gold" })
    else if (payment === "released" || payment === "paid")
      pills.push({
        key: "paymentReleased",
        className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
      })
    else if (payment === "refunded")
      pills.push({
        key: "paymentRefunded",
        className: "border-cream/20 bg-cream/5 text-cream/60",
      })

    if (refund === "requested")
      pills.push({
        key: "refundRequested",
        className: "border-gold/30 bg-gold/10 text-gold",
      })
    else if (refund === "approved")
      pills.push({
        key: "refundApproved",
        className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
      })
    else if (refund === "rejected")
      pills.push({
        key: "refundRejected",
        className: "border-red-400/30 bg-red-400/10 text-red-300",
      })

    if (pills.length === 0) return null

    return (
      <span className="flex flex-wrap gap-1.5">
        {pills.map((pill) => (
          <span
            key={pill.key}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${pill.className}`}
          >
            {t(`dashboard.customer.badges.${pill.key}`)}
          </span>
        ))}
      </span>
    )
  }

  function renderBooking(booking: Booking, isUpcoming: boolean) {
    const venue = venues.find((item) => item.id === booking.venueId)
    // Database bookings carry the raw service/provider labels; local records
    // fall back to the static pool + i18n table.
    const professionalName =
      booking.professionalName ??
      (booking.professionalId ? getProfessionalById(booking.professionalId)?.name : undefined)
    const serviceLabel = booking.serviceName ?? t(`venues.services.${booking.serviceId}`)
    const date = parseDateKey(booking.date)
    // Inside the 1h30m window the client can do neither of the two actions, so
    // they are disabled together and the reason is spelled out on the row.
    const canModify = booking.canModify !== false

    return (
      <li
        key={booking.id}
        className="border-cream/10 bg-cream/2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5"
      >
        <span className="border-gold/25 bg-gold/10 text-gold flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl border text-[10px] leading-tight uppercase">
          <span className="text-base font-semibold tabular-nums">
            {formatDate(date, locale, { day: "numeric" })}
          </span>
          <span>{formatDate(date, locale, { month: "short" })}</span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {venue ? (
              <Link
                href={`/venues/${venue.id}`}
                className="text-cream hover:text-gold block truncate text-sm font-semibold transition"
              >
                {venue.name}
              </Link>
            ) : (
              <span className="text-cream block truncate text-sm font-semibold">
                {booking.venueId}
              </span>
            )}
            <AppointmentStatusBadge status={booking.displayStatus ?? "pending"} />
          </span>
          <span className="text-cream/50 mt-1 block text-xs">
            {serviceLabel} ·{" "}
            {t("dashboard.customer.atTime", {
              time: formatTime(new Date(`${booking.date}T${booking.time}:00`), locale),
            })}
            {professionalName ? ` · ${professionalName}` : ""}
          </span>
          {lifecycleBadge(booking)}
          {booking.displayStatus === "cancelled" && booking.cancellationReason && (
            <span className="text-cream/45 mt-1.5 block text-xs italic">
              {t("dashboard.customer.cancelReason", { reason: booking.cancellationReason })}
            </span>
          )}
          {isUpcoming && !canModify && (
            <span className="border-gold/30 bg-gold/10 text-gold mt-2 flex items-start gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs leading-snug">
              <Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong className="font-semibold">
                  {t("dashboard.customer.changesLockedTitle")}:
                </strong>{" "}
                {t("dashboard.customer.changesLockedBody")}
              </span>
            </span>
          )}
        </span>

        <span className="text-cream/70 text-sm font-semibold tabular-nums">
          {formatCurrency(booking.price, locale, "USD", { maximumFractionDigits: 0 })}
        </span>

        {isUpcoming ? (
          <BookingRowActions
            canModify={canModify}
            onEdit={() => setPendingEdit(booking)}
            onCancel={() => setPendingCancel(booking)}
          />
        ) : (
          <ButtonLink
            href={`/venues/${booking.venueId}?service=${encodeURIComponent(booking.serviceId)}`}
            variant="outline"
            size="sm"
            iconLeft={<Icon name="sparkles" className="size-4" />}
          >
            {t("dashboard.customer.rebook")}
          </ButtonLink>
        )}
      </li>
    )
  }

  return (
    <section className="space-y-6">
      <div id="upcoming" className="border-cream/10 bg-ink-card scroll-mt-6 rounded-4xl border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">
              {t("dashboard.customer.upcomingTitle")}
            </h2>
            <p className="text-cream/50 mt-1 text-sm">{t("dashboard.customer.appointmentsBody")}</p>
          </div>
          <Link
            href="/venues"
            className="text-gold inline-flex items-center gap-1.5 text-sm underline-offset-4 transition hover:underline"
          >
            {t("dashboard.customer.exploreVenues")}
            <Icon name="arrow-right" className="size-4" />
          </Link>
        </div>

        {!ready ? (
          <div className="mt-5 space-y-3">
            {[0, 1].map((index) => (
              <div key={index} className="bg-cream/5 h-16 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : upcoming.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {upcoming.map((booking) => renderBooking(booking, true))}
          </ul>
        ) : (
          <div className="border-cream/10 mt-5 flex flex-col items-center gap-4 rounded-3xl border border-dashed px-6 py-8 text-center">
            <Icon name="calendar" className="text-cream/25 size-7" />
            <p className="text-cream/55 text-sm">{t("dashboard.customer.upcomingEmpty")}</p>
            <ButtonLink href="/venues" size="sm">
              {t("dashboard.customer.exploreVenues")}
            </ButtonLink>
          </div>
        )}
      </div>

      <div id="history" className="border-cream/10 bg-ink-card scroll-mt-6 rounded-4xl border p-6">
        <h2 className="font-display text-xl font-semibold">
          {t("dashboard.customer.historyTitle")}
        </h2>

        {!ready ? (
          <div className="mt-5 space-y-3">
            {[0, 1].map((index) => (
              <div key={index} className="bg-cream/5 h-16 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : past.length > 0 ? (
          <>
            <ul className="mt-5 space-y-3">
              {past.slice(0, visibleHistory).map((booking) => renderBooking(booking, false))}
            </ul>
            {past.length > visibleHistory && (
              <div className="mt-5 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleHistory((count) => count + HISTORY_PAGE)}
                >
                  {t("dashboard.customer.loadMore", { count: past.length - visibleHistory })}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-cream/55 mt-3 text-sm">{t("dashboard.customer.historyEmpty")}</p>
        )}
      </div>

      {/* Reason-prompting cancel, shared with the overview hero so both entry
          points enforce the same rule and store the same reason. */}
      <CustomerCancelDialog
        booking={pendingCancel}
        cancel={cancel}
        onClose={() => setPendingCancel(null)}
      />

      {pendingEdit && (
        <RescheduleDialog
          booking={pendingEdit}
          reschedule={reschedule}
          onClose={() => setPendingEdit(null)}
        />
      )}
    </section>
  )
}
