"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { useProviderAppointments } from "@/hooks/use-provider-appointments"
import { type Booking } from "@/hooks/use-bookings"
import { useAllVenues } from "@/hooks/use-venues"
import { parseDateKey } from "@/utils/date"
import { formatCurrency, formatDate, formatTime, toIntlLocale } from "@/utils/format"

/** Map a stored status onto the translation key, defaulting to pending. */
function statusKey(status: string | undefined): string {
  if (status === "confirmed" || status === "completed" || status === "cancelled") return status
  return "pending"
}

/** Professional dashboard block: the appointments booked with them. */
export function ProviderAppointmentsSection() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language ?? "es")
  const venues = useAllVenues()
  const { upcoming, past, setStatus } = useProviderAppointments()
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null)

  function handleConfirmCancel() {
    if (!pendingCancel) return
    void setStatus(pendingCancel.id, "cancelled")
    setPendingCancel(null)
    toast(t("dashboard.professional.appointments.cancelled"))
  }

  function complete(booking: Booking) {
    void setStatus(booking.id, "completed")
    toast(t("dashboard.professional.appointments.completed"))
  }

  function renderBooking(booking: Booking, isUpcoming: boolean) {
    const venue = venues.find((item) => item.id === booking.venueId)
    const client =
      booking.clientName?.trim() || t("dashboard.professional.appointments.clientFallback")
    const service = booking.serviceName ?? t(`venues.services.${booking.serviceId}`)
    const date = parseDateKey(booking.date)
    const status = statusKey(booking.status)

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
          <span className="text-cream block truncate text-sm font-semibold">{client}</span>
          <span className="text-cream/50 mt-1 block text-xs">
            {service} ·{" "}
            {t("dashboard.professional.appointments.atTime", {
              time: formatTime(new Date(`${booking.date}T${booking.time}:00`), locale),
            })}
            {booking.clientPhone ? ` · ${booking.clientPhone}` : ""}
            {venue ? ` · ${venue.name}` : ""}
          </span>
        </span>

        <span
          className={
            status === "cancelled"
              ? "text-cream/45 border-cream/20 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium"
              : "border-gold/30 bg-gold/10 text-gold-soft shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium"
          }
        >
          {t(`dashboard.professional.appointments.status.${status}`)}
        </span>

        <span className="text-cream/70 text-sm font-semibold">
          {formatCurrency(booking.price, locale, "DOP", { maximumFractionDigits: 0 })}
        </span>

        {isUpcoming && status !== "cancelled" ? (
          <span className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => complete(booking)}
              iconLeft={<Icon name="check-circle" className="size-4" />}
            >
              {t("dashboard.professional.appointments.complete")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingCancel(booking)}
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
        onConfirm={handleConfirmCancel}
        onClose={() => setPendingCancel(null)}
      />
    </section>
  )
}
