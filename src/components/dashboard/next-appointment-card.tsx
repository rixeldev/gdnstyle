"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { AppointmentStatusBadge } from "@/components/dashboard/appointment-status-badge"
import { BookingRowActions } from "@/components/dashboard/customer-cancel-dialog"
import { ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import type { Booking } from "@/hooks/use-bookings"
import type { Venue } from "@/constants/venues"
import { minutesUntilStart } from "@/utils/appointment-status"
import { parseDateKey } from "@/utils/date"
import { formatCurrency, formatDate, formatTime } from "@/utils/format"

interface NextAppointmentCardProps {
  booking: Booking
  venue?: Venue
  locale: string
  onCancel: () => void
  onEdit: () => void
}

/** "in 2 hours" / "in 3 days", the client's only real question about a booking. */
function countdown(booking: Booking, nowMs: number, t: (k: string, o?: object) => string): string {
  const minutes = minutesUntilStart(booking, nowMs)
  if (minutes <= 0) return t("dashboard.customer.countdown.now")
  if (minutes < 60) return t("dashboard.customer.countdown.minutes", { count: minutes })
  // Rounded so the plural never reads "1.5 hours".
  if (minutes < 60 * 24)
    return t("dashboard.customer.countdown.hours", { count: Math.round(minutes / 60) })
  return t("dashboard.customer.countdown.days", { count: Math.round(minutes / (60 * 24)) })
}

/**
 * The one booking that matters, given the whole width of the dashboard: the
 * venue photograph, the exact hour, how far away it is, and both actions
 * (locked together inside the 1h30m window, same rule as the list).
 */
export function NextAppointmentCard({
  booking,
  venue,
  locale,
  onCancel,
  onEdit,
}: NextAppointmentCardProps) {
  const { t } = useTranslation()
  const start = new Date(`${booking.date}T${booking.time}:00`)
  // Captured on mount so the countdown cannot jump on an unrelated re-render.
  const [nowMs] = useState(() => Date.now())
  const canModify = booking.canModify !== false
  const service = booking.serviceName ?? t(`venues.services.${booking.serviceId}`)

  return (
    <article className="border-gold/20 bg-ink-card relative overflow-hidden rounded-4xl border">
      {venue && (
        <Image
          src={venue.image}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 60rem"
          priority
          className="object-cover"
        />
      )}
      <div
        aria-hidden="true"
        className="from-ink via-ink/94 to-ink/45 absolute inset-0 bg-gradient-to-r"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(224,176,68,0.18),transparent_58%)]"
      />

      <div className="relative flex flex-wrap items-center gap-x-7 gap-y-5 p-6 md:p-8">
        <div className="border-gold/30 bg-ink/70 flex size-24 shrink-0 flex-col items-center justify-center rounded-3xl border backdrop-blur-sm">
          <span className="font-display text-3xl leading-none font-semibold">
            {formatDate(parseDateKey(booking.date), locale, { day: "numeric" })}
          </span>
          <span className="text-gold-soft mt-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
            {formatDate(parseDateKey(booking.date), locale, { month: "short" })}
          </span>
          <span className="text-cream/45 mt-0.5 text-[10px] tracking-wide uppercase">
            {formatDate(parseDateKey(booking.date), locale, { weekday: "short" })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-gold text-[11px] font-semibold tracking-[0.22em] uppercase">
              {t("dashboard.customer.nextUp")}
            </p>
            <AppointmentStatusBadge status={booking.displayStatus ?? "pending"} />
          </div>

          {venue ? (
            <Link
              href={`/venues/${venue.id}`}
              className="font-display hover:text-gold mt-1.5 block truncate text-2xl leading-tight font-semibold transition md:text-3xl"
            >
              {venue.name}
            </Link>
          ) : (
            <p className="font-display mt-1.5 truncate text-2xl leading-tight font-semibold md:text-3xl">
              {booking.venueId}
            </p>
          )}

          <p className="text-cream/70 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="sparkles" className="text-gold size-4" />
              {service}
            </span>
            <span className="text-cream/25">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="clock" className="text-gold size-4" />
              {formatTime(start, locale)}
            </span>
            {booking.professionalName && (
              <>
                <span className="text-cream/25">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="user" className="text-gold size-4" />
                  {booking.professionalName}
                </span>
              </>
            )}
          </p>

          <p className="text-cream/55 mt-3 text-xs">
            {t("dashboard.customer.countdown.startsIn", {
              when: countdown(booking, nowMs, t as never),
            })}
          </p>

          {!canModify && (
            <p className="border-gold/30 bg-gold/10 text-gold mt-3 flex items-start gap-1.5 rounded-xl border px-3 py-2 text-xs leading-snug">
              <Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong className="font-semibold">
                  {t("dashboard.customer.changesLockedTitle")}:
                </strong>{" "}
                {t("dashboard.customer.changesLockedBody")}
              </span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3">
          <p className="font-display text-2xl font-semibold tabular-nums">
            {formatCurrency(booking.price, locale, "USD", { maximumFractionDigits: 0 })}
          </p>
          <div className="flex flex-col items-stretch gap-2">
            <BookingRowActions canModify={canModify} onEdit={onEdit} onCancel={onCancel} />
            {venue && (
              <ButtonLink
                href={`/venues/${venue.id}`}
                variant="subtle"
                size="sm"
                iconLeft={<Icon name="arrow-up-right" className="size-4" />}
              >
                {t("dashboard.customer.viewVenue")}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
