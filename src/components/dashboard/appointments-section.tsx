"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, ButtonLink } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { getProfessionalById } from "@/constants/professionals"
import { useAllVenues } from "@/hooks/use-venues"
import { type Booking, useBookings } from "@/hooks/use-bookings"
import { parseDateKey } from "@/utils/date"
import { formatCurrency, formatDate, formatTime, toIntlLocale } from "@/utils/format"

/** Customer dashboard block: real local bookings plus history and cancel. */
export function AppointmentsSection() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language ?? "es")
  const venues = useAllVenues()
  const { upcoming, past, ready, cancel } = useBookings()
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null)

  function handleConfirmCancel() {
    if (!pendingCancel) return
    cancel(pendingCancel.id)
    setPendingCancel(null)
    toast(t("dashboard.customer.cancelled"))
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
          {venue ? (
            <Link
              href={`/locales/${venue.id}`}
              className="text-cream hover:text-gold block truncate text-sm font-semibold transition"
            >
              {venue.name}
            </Link>
          ) : (
            <span className="text-cream block truncate text-sm font-semibold">
              {booking.venueId}
            </span>
          )}
          <span className="text-cream/50 mt-1 block text-xs">
            {serviceLabel} ·{" "}
            {t("dashboard.customer.atTime", {
              time: formatTime(new Date(`${booking.date}T${booking.time}:00`), locale),
            })}
            {professionalName ? ` · ${professionalName}` : ""}
          </span>
        </span>

        <span className="text-cream/70 text-sm font-semibold">
          {formatCurrency(booking.price, locale, "DOP", { maximumFractionDigits: 0 })}
        </span>

        {isUpcoming ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPendingCancel(booking)}
            iconLeft={<Icon name="trash" className="size-4" />}
          >
            {t("dashboard.customer.cancel")}
          </Button>
        ) : (
          <span className="text-cream/35 text-xs">{t("dashboard.customer.history")}</span>
        )}
      </li>
    )
  }

  return (
    <section className="space-y-6">
      <div className="border-cream/10 bg-ink-card rounded-4xl border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">
              {t("dashboard.customer.upcomingTitle")}
            </h2>
            <p className="text-cream/50 mt-1 text-sm">{t("dashboard.customer.appointmentsBody")}</p>
          </div>
          <Link
            href="/locales"
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
            <ButtonLink href="/locales" size="sm">
              {t("dashboard.customer.exploreVenues")}
            </ButtonLink>
          </div>
        )}
      </div>

      {ready && past.length > 0 && (
        <div className="border-cream/10 bg-ink-card rounded-4xl border p-6">
          <h2 className="font-display text-xl font-semibold">
            {t("dashboard.customer.historyTitle")}
          </h2>
          <ul className="mt-5 space-y-3">{past.map((booking) => renderBooking(booking, false))}</ul>
        </div>
      )}

      <div className="border-cream/10 bg-cream/2 flex flex-wrap items-center gap-3 rounded-3xl border px-5 py-4">
        <span className="text-cream/40 text-[11px] tracking-[0.16em] uppercase">
          {t("dashboard.customer.quickLinks")}
        </span>
        <ButtonLink
          href="/favoritos"
          variant="outline"
          size="sm"
          iconLeft={<Icon name="heart" className="size-4" />}
        >
          {t("dashboard.customer.manageFavorites")}
        </ButtonLink>
      </div>

      <ConfirmDialog
        open={pendingCancel !== null}
        title={t("dashboard.customer.cancelConfirmTitle")}
        body={
          pendingCancel
            ? t("dashboard.customer.cancelConfirmBody", {
                service: t(`venues.services.${pendingCancel.serviceId}`),
                date: formatDate(parseDateKey(pendingCancel.date), locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }),
              })
            : undefined
        }
        confirmLabel={t("dashboard.customer.cancelConfirm")}
        cancelLabel={t("dashboard.customer.cancelKeep")}
        tone="danger"
        onConfirm={handleConfirmCancel}
        onClose={() => setPendingCancel(null)}
      />
    </section>
  )
}
