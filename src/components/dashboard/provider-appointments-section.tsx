"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"

import { AppointmentStatusBadge } from "@/components/dashboard/appointment-status-badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Icon } from "@/components/ui/icon"
import { TextArea } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { useProviderAppointments } from "@/hooks/use-provider-appointments"
import { type Booking } from "@/hooks/use-bookings"
import { useAllVenues } from "@/hooks/use-venues"
import { parseDateKey } from "@/utils/date"
import { formatCurrency, formatDate, formatTime, toIntlLocale } from "@/utils/format"

/** Professional dashboard block: the appointments booked with them. */
export function ProviderAppointmentsSection() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const venues = useAllVenues()
  const { upcoming, past, refundRequests, confirmBooking, resolveRefund, cancelBooking } =
    useProviderAppointments()
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null)
  // Both sides must explain themselves: the reason is stored on the row so the
  // client reads it on theirs.
  const [cancelReason, setCancelReason] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [resolving, setResolving] = useState(false)

  function openCancelDialog(booking: Booking) {
    setCancelReason("")
    setPendingCancel(booking)
  }

  async function handleConfirmCancel() {
    if (!pendingCancel || !cancelReason.trim()) return
    const id = pendingCancel.id
    const reason = cancelReason.trim()
    setCancelling(true)
    const ok = await cancelBooking(id, reason)
    setCancelling(false)
    setPendingCancel(null)
    setCancelReason("")
    toast(
      ok ? t("dashboard.professional.appointments.cancelled") : t("common.tryAgain"),
      ok ? "success" : "neutral",
    )
  }

  function confirm(booking: Booking) {
    void confirmBooking(booking.id).then((ok) => {
      toast(
        ok ? t("dashboard.professional.appointments.confirmed") : t("common.tryAgain"),
        ok ? "success" : "neutral",
      )
    })
  }

  async function handleRefund(booking: Booking, resolution: "approved" | "rejected") {
    setResolving(true)
    const ok = await resolveRefund(booking.id, resolution)
    setResolving(false)
    toast(
      ok
        ? resolution === "approved"
          ? t("dashboard.professional.appointments.refundApproved")
          : t("dashboard.professional.appointments.refundRejected")
        : t("common.tryAgain"),
      ok ? "success" : "neutral",
    )
  }

  /** Payment lifecycle pill (pending → released → refunded). */
  function paymentBadge(booking: Booking) {
    const payment = (booking.paymentStatus ?? "").toLowerCase()
    if (!payment || payment === "none" || payment === "refunded") return null

    const className =
      payment === "pending"
        ? "border-gold/30 bg-gold/10 text-gold"
        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    const label =
      payment === "pending"
        ? t("dashboard.customer.badges.paymentPending")
        : t("dashboard.customer.badges.paymentReleased")

    return (
      <span
        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${className}`}
      >
        {label}
      </span>
    )
  }

  function renderBooking(booking: Booking, isUpcoming: boolean) {
    const venue = venues.find((item) => item.id === booking.venueId)
    const client =
      booking.clientName?.trim() || t("dashboard.professional.appointments.clientFallback")
    const service = booking.serviceName ?? t(`venues.services.${booking.serviceId}`)
    const date = parseDateKey(booking.date)
    const status = booking.displayStatus ?? "pending"

    return (
      <li
        key={booking.id}
        className="border-cream/10 bg-cream/2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5"
      >
        <span className="border-gold/25 bg-gold/10 text-gold flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl border text-[10px] leading-tight uppercase">
          <span className="text-base font-semibold">
            {formatDate(date, locale, { day: "numeric" })}
          </span>
          <span>{formatDate(date, locale, { month: "short" })}</span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-cream block truncate text-sm font-semibold">{client}</span>
            <AppointmentStatusBadge status={status} />
          </span>
          <span className="text-cream/50 mt-1 block text-xs">
            {service} ·{" "}
            {t("dashboard.professional.appointments.atTime", {
              time: formatTime(new Date(`${booking.date}T${booking.time}:00`), locale),
            })}
            {booking.clientPhone ? ` · ${booking.clientPhone}` : ""}
            {venue ? ` · ${venue.name}` : ""}
          </span>
          {paymentBadge(booking)}
          {status === "cancelled" && booking.cancellationReason && (
            <span className="text-cream/45 mt-1.5 block text-xs italic">
              {t("dashboard.professional.appointments.cancelReason", {
                reason: booking.cancellationReason,
              })}
            </span>
          )}
        </span>

        <span className="text-cream/70 text-sm font-semibold">
          {formatCurrency(booking.price, locale, "USD", { maximumFractionDigits: 0 })}
        </span>

        {isUpcoming && status !== "cancelled" ? (
          <span className="flex gap-2">
            {(status === "pending" || status === "overdue") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => confirm(booking)}
                iconLeft={<Icon name="badge-check" className="size-4" />}
              >
                {t("dashboard.professional.appointments.confirm")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openCancelDialog(booking)}
              iconLeft={<Icon name="trash" className="size-4" />}
            >
              {t("dashboard.professional.appointments.cancel")}
            </Button>
          </span>
        ) : null}
      </li>
    )
  }

  return (
    <section className="space-y-6">
      <div className="border-cream/10 bg-ink-card rounded-4xl border p-6">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {t("dashboard.professional.appointments.title")}
          </h2>
          <p className="text-cream/50 mt-1 text-sm">
            {t("dashboard.professional.appointments.body")}
          </p>
        </div>

        {upcoming.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {upcoming.map((booking) => renderBooking(booking, true))}
          </ul>
        ) : (
          <div className="border-cream/10 mt-5 flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-8 text-center">
            <Icon name="calendar" className="text-cream/25 size-7" />
            <p className="text-cream/55 text-sm">
              {t("dashboard.professional.appointments.empty")}
            </p>
          </div>
        )}
      </div>

      {refundRequests.length > 0 && (
        <div className="border-gold/25 bg-gold/5 rounded-4xl border p-6">
          <h2 className="font-display text-xl font-semibold">
            {t("dashboard.professional.appointments.refundTitle")}
          </h2>
          <p className="text-cream/50 mt-1 text-sm">
            {t("dashboard.professional.appointments.refundBody")}
          </p>
          <ul className="mt-5 space-y-3">
            {refundRequests.map((booking) => {
              const client =
                booking.clientName?.trim() ||
                t("dashboard.professional.appointments.clientFallback")
              return (
                <li
                  key={booking.id}
                  className="border-cream/10 bg-cream/2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-cream block truncate text-sm font-semibold">
                      {client}
                    </span>
                    <span className="text-cream/50 mt-1 block text-xs">
                      {booking.serviceName ?? t(`venues.services.${booking.serviceId}`)} ·{" "}
                      {formatDate(parseDateKey(booking.date), locale, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </span>
                  <span className="text-cream/70 text-sm font-semibold">
                    {formatCurrency(booking.price, locale, "USD", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      loading={resolving}
                      onClick={() => handleRefund(booking, "approved")}
                      iconLeft={<Icon name="check-circle" className="size-4" />}
                    >
                      {t("dashboard.professional.appointments.refundApprove")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={resolving}
                      onClick={() => handleRefund(booking, "rejected")}
                    >
                      {t("dashboard.professional.appointments.refundReject")}
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <div className="border-cream/10 bg-ink-card rounded-4xl border p-6">
          <h2 className="font-display text-xl font-semibold">
            {t("dashboard.professional.appointments.historyTitle")}
          </h2>
          <ul className="mt-5 space-y-3">{past.map((booking) => renderBooking(booking, false))}</ul>
        </div>
      )}

      <ConfirmDialog
        open={pendingCancel !== null}
        tone="danger"
        title={t("dashboard.professional.appointments.cancelConfirmTitle")}
        body={
          pendingCancel
            ? t("dashboard.professional.appointments.cancelConfirmBody", {
                client:
                  pendingCancel.clientName?.trim() ||
                  t("dashboard.professional.appointments.clientFallback"),
                date: formatDate(parseDateKey(pendingCancel.date), locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }),
              })
            : undefined
        }
        confirmLabel={t("dashboard.professional.appointments.cancelConfirm")}
        cancelLabel={t("dashboard.professional.appointments.cancelKeep")}
        loading={cancelling}
        confirmDisabled={!cancelReason.trim()}
        onConfirm={handleConfirmCancel}
        onClose={() => setPendingCancel(null)}
      >
        <TextArea
          label={t("dashboard.professional.appointments.cancelReasonLabel")}
          hint={t("dashboard.professional.appointments.cancelReasonHint")}
          placeholder={t("dashboard.professional.appointments.cancelReasonPlaceholder")}
          rows={3}
          maxLength={300}
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </ConfirmDialog>
    </section>
  )
}
