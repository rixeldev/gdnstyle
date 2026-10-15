"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { AppointmentStatusBadge } from "@/components/dashboard/appointment-status-badge"
import { CustomerCancelDialog } from "@/components/dashboard/customer-cancel-dialog"
import { NextAppointmentCard } from "@/components/dashboard/next-appointment-card"
import { RescheduleDialog } from "@/components/dashboard/reschedule-dialog"
import {
  EmptyState,
  Panel,
  PanelHead,
  StatTile,
  ViewHeading,
} from "@/components/dashboard/view-primitives"
import { ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { type Booking, useBookings } from "@/hooks/use-bookings"
import { useFavorites } from "@/hooks/use-favorites"
import { useAllVenues } from "@/hooks/use-venues"
import type { IconName } from "@/interfaces/common"
import { parseDateKey } from "@/utils/date"
import { formatCurrency, formatDate, toIntlLocale } from "@/utils/format"

/** Rows of the activity feed on the overview. */
const ACTIVITY_ROWS = 4

/** Shortcuts on the overview. `link` leaves the dashboard, `view` switches tab. */
type QuickAction =
  | { id: string; icon: IconName; labelKey: string; bodyKey: string; kind: "link"; href: string }
  | { id: string; icon: IconName; labelKey: string; bodyKey: string; kind: "view"; view: string }

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "book",
    icon: "sparkles",
    labelKey: "dashboard.customer.exploreVenues",
    bodyKey: "dashboard.customer.quickBookBody",
    kind: "link",
    href: "/venues",
  },
  {
    id: "favorites",
    icon: "heart",
    labelKey: "dashboard.nav.favorites",
    bodyKey: "dashboard.customer.quickFavoritesBody",
    kind: "link",
    href: "/favorites",
  },
  {
    id: "payments",
    icon: "credit-card",
    labelKey: "dashboard.nav.payments",
    bodyKey: "dashboard.customer.quickPaymentsBody",
    kind: "view",
    view: "payments",
  },
  {
    id: "profile",
    icon: "user",
    labelKey: "dashboard.nav.profile",
    bodyKey: "dashboard.customer.quickProfileBody",
    kind: "view",
    view: "profile",
  },
]

interface CustomerOverviewProps {
  onNavigate: (view: string) => void
}

/**
 * The client's front page: the next appointment at full width, four counters,
 * then what already happened and where to go next. Everything that needs a
 * decision (move it, cancel it) is reachable from the hero.
 */
export function CustomerOverview({ onNavigate }: CustomerOverviewProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const venues = useAllVenues()
  const { bookings, upcoming, past, ready, cancel, reschedule } = useBookings()
  const { count: favoritesCount, ready: favoritesReady } = useFavorites()

  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [editing, setEditing] = useState<Booking | null>(null)

  const next = upcoming[0]
  const nextVenue = next ? venues.find((venue) => venue.id === next.venueId) : undefined
  const activity = past.slice(0, ACTIVITY_ROWS)

  return (
    <div className="space-y-6">
      <ViewHeading
        eyebrow={t("dashboard.customer.role")}
        title={t("dashboard.customer.overviewTitle")}
        body={t("dashboard.customer.overviewBody")}
      />

      {!ready ? (
        <div aria-hidden="true" className="bg-cream/5 h-56 animate-pulse rounded-4xl" />
      ) : next ? (
        <NextAppointmentCard
          booking={next}
          venue={nextVenue}
          locale={locale}
          onCancel={() => setCancelling(next)}
          onEdit={() => setEditing(next)}
        />
      ) : (
        <EmptyState
          icon={<Icon name="calendar" className="size-8" />}
          title={t("dashboard.customer.upcomingEmpty")}
          body={t("dashboard.customer.overviewEmptyBody")}
          action={
            <ButtonLink href="/venues" size="sm">
              {t("dashboard.customer.exploreVenues")}
            </ButtonLink>
          }
        />
      )}

      <section
        aria-label={t("dashboard.customer.summaryLabel")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatTile
          icon={<Icon name="calendar" className="size-5" />}
          label={t("dashboard.customer.statTotal")}
          value={
            ready ? bookings.length : <span className="bg-cream/10 h-6 w-8 animate-pulse rounded" />
          }
        />
        <StatTile
          icon={<Icon name="clock" className="size-5" />}
          label={t("dashboard.customer.statUpcoming")}
          value={
            ready ? upcoming.length : <span className="bg-cream/10 h-6 w-8 animate-pulse rounded" />
          }
        />
        <StatTile
          icon={<Icon name="check-circle" className="size-5" />}
          label={t("dashboard.customer.statCompleted")}
          value={
            ready ? past.length : <span className="bg-cream/10 h-6 w-8 animate-pulse rounded" />
          }
        />
        <StatTile
          icon={<Icon name="heart" className="size-5" />}
          label={t("dashboard.customer.statFavorites")}
          value={
            favoritesReady ? (
              favoritesCount
            ) : (
              <span className="bg-cream/10 h-6 w-8 animate-pulse rounded" />
            )
          }
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHead
            title={t("dashboard.customer.overviewActivity")}
            body={t("dashboard.customer.overviewActivityBody")}
            action={
              <button
                type="button"
                onClick={() => onNavigate("appointments")}
                className="text-gold inline-flex items-center gap-1.5 text-sm underline-offset-4 transition hover:underline"
              >
                {t("dashboard.nav.appointments")}
                <Icon name="arrow-right" className="size-4" />
              </button>
            }
          />

          {!ready ? (
            <div className="mt-4 space-y-2">
              {[0, 1].map((index) => (
                <div key={index} className="bg-cream/5 h-14 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : activity.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {activity.map((booking) => {
                const venue = venues.find((item) => item.id === booking.venueId)
                return (
                  <li
                    key={booking.id}
                    className="border-cream/8 bg-cream/2 flex items-center gap-3 rounded-2xl border px-3.5 py-2.5"
                  >
                    <span className="text-cream/55 shrink-0 text-xs font-semibold tabular-nums">
                      {formatDate(parseDateKey(booking.date), locale, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {venue?.name ?? booking.venueId}
                      </span>
                      <span className="text-cream/45 block truncate text-xs">
                        {booking.serviceName ?? t(`venues.services.${booking.serviceId}`)}
                      </span>
                    </span>
                    <AppointmentStatusBadge status={booking.displayStatus ?? "pending"} />
                    <span className="text-cream/60 shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(booking.price, locale, "USD", { maximumFractionDigits: 0 })}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-cream/50 mt-4 text-sm">{t("dashboard.customer.historyEmpty")}</p>
          )}
        </Panel>

        <Panel>
          <PanelHead
            title={t("dashboard.customer.overviewActions")}
            body={t("dashboard.customer.overviewActionsBody")}
          />
          <ul className="mt-4 space-y-2">
            {QUICK_ACTIONS.map((item) => {
              const inner = (
                <>
                  <span className="border-gold/25 bg-gold/10 text-gold flex size-9 shrink-0 items-center justify-center rounded-xl border">
                    <Icon name={item.icon} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t(item.labelKey)}</span>
                    <span className="text-cream/50 block text-xs leading-snug">
                      {t(item.bodyKey)}
                    </span>
                  </span>
                  <Icon name="arrow-right" className="text-cream/30 size-4 shrink-0" />
                </>
              )
              const className =
                "border-cream/8 bg-cream/2 hover:border-gold/40 flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition"

              return (
                <li key={item.id}>
                  {item.kind === "link" ? (
                    <Link href={item.href} className={className}>
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigate(item.view)}
                      className={className}
                    >
                      {inner}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <CustomerCancelDialog
        booking={cancelling}
        cancel={cancel}
        onClose={() => setCancelling(null)}
      />

      {editing && (
        <RescheduleDialog
          booking={editing}
          reschedule={reschedule}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
