"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { AppointmentStatusBadge } from "@/components/dashboard/appointment-status-badge"
import {
  EmptyState,
  Panel,
  PanelHead,
  StatTile,
  ViewHeading,
} from "@/components/dashboard/view-primitives"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { useProviderAppointments } from "@/hooks/use-provider-appointments"
import { type Booking } from "@/hooks/use-bookings"
import { useOwnedVenues } from "@/hooks/use-venues"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { getProviderPayments } from "@/services/payments.service"
import { toDateKey } from "@/utils/date"
import { formatCurrency, formatDate, formatTime, toIntlLocale } from "@/utils/format"

/** Rows of the day's agenda before it scrolls. */
const AGENDA_LIMIT = 8

interface ProfessionalOverviewProps {
  onNavigate: (view: string) => void
}

/**
 * The professional's front page: what needs a decision today, not a list of
 * everything ever booked. Today's agenda is first because confirming or
 * refusing a booking is the only thing that cannot wait; money and listings
 * follow.
 */
export function ProfessionalOverview({ onNavigate }: ProfessionalOverviewProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const { user } = useSession()
  const supabase = getSupabaseBrowserClient()
  const { upcoming, past, refundRequests, confirmBooking } = useProviderAppointments()
  const owned = useOwnedVenues()
  const [monthEarnings, setMonthEarnings] = useState<number | null>(null)

  useEffect(() => {
    if (!supabase || !user?.providerId) return
    let active = true
    void getProviderPayments(locale)
      .then((value) => {
        if (active) setMonthEarnings(value.stats.monthlyEarnings ?? 0)
      })
      .catch(() => {
        if (active) setMonthEarnings(0)
      })
    return () => {
      active = false
    }
  }, [supabase, user?.providerId, locale])

  const todayKey = toDateKey(new Date())
  const agenda = upcoming.filter((booking) => booking.date === todayKey).slice(0, AGENDA_LIMIT)
  const awaiting = upcoming.filter((booking) => booking.displayStatus === "pending")
  const overdue = upcoming.filter((booking) => booking.displayStatus === "overdue")
  const needsAttention = overdue.length + refundRequests.length

  function confirm(booking: Booking) {
    void confirmBooking(booking.id).then((ok) => {
      toast(
        ok ? t("dashboard.professional.appointments.confirmed") : t("common.tryAgain"),
        ok ? "success" : "neutral",
      )
    })
  }

  return (
    <div className="space-y-6">
      <ViewHeading
        eyebrow={t("dashboard.professional.console")}
        title={t("dashboard.professional.overviewTitle")}
        body={t("dashboard.professional.overviewBody")}
        actions={
          <Button
            variant="outline"
            onClick={() => onNavigate("appointments")}
            iconLeft={<Icon name="inbox" className="size-4" />}
          >
            {t("dashboard.nav.appointments")}
          </Button>
        }
      />

      <section
        aria-label={t("dashboard.professional.overviewStats")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <StatTile
          tone="cool"
          icon={<Icon name="calendar" className="size-5" />}
          label={t("dashboard.professional.kpis.today")}
          value={agenda.length}
          hint={formatDate(new Date(), locale, { weekday: "long" })}
        />
        <StatTile
          tone="cool"
          icon={<Icon name="clock" className="size-5" />}
          label={t("dashboard.professional.kpis.awaiting")}
          value={awaiting.length}
        />
        <StatTile
          tone="cool"
          icon={<Icon name="alert" className="size-5" />}
          label={t("dashboard.professional.kpis.attention")}
          value={needsAttention}
          hint={
            refundRequests.length > 0
              ? t("dashboard.professional.kpis.refundsHint", { count: refundRequests.length })
              : undefined
          }
        />
        <StatTile
          tone="cool"
          icon={<Icon name="trending-up" className="size-5" />}
          label={t("dashboard.professional.kpis.month")}
          value={
            monthEarnings === null ? (
              <span className="bg-cream/10 inline-block h-6 w-14 animate-pulse rounded" />
            ) : (
              formatCurrency(monthEarnings, locale, "USD", { maximumFractionDigits: 0 })
            )
          }
        />
        <StatTile
          tone="cool"
          icon={<Icon name="store" className="size-5" />}
          label={t("dashboard.professional.kpis.venues")}
          value={owned.length}
        />
        <StatTile
          tone="cool"
          icon={<Icon name="star" className="size-5" />}
          label={t("dashboard.professional.kpis.rating")}
          value={
            owned.some((venue) => venue.reviews > 0)
              ? (
                  owned
                    .filter((venue) => venue.reviews > 0)
                    .reduce((sum, venue) => sum + venue.rating, 0) /
                  owned.filter((venue) => venue.reviews > 0).length
                ).toFixed(1)
              : "—"
          }
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            title={t("dashboard.professional.agenda.title")}
            body={t("dashboard.professional.agenda.body")}
            action={
              <button
                type="button"
                onClick={() => onNavigate("appointments")}
                className="text-gold inline-flex items-center gap-1.5 text-sm underline-offset-4 transition hover:underline"
              >
                {t("dashboard.professional.agenda.all")}
                <Icon name="arrow-right" className="size-4" />
              </button>
            }
          />

          {agenda.length > 0 ? (
            <ol className="border-cream/8 mt-4 space-y-2 border-l pl-5">
              {agenda.map((booking) => (
                <li key={booking.id} className="relative">
                  <span
                    aria-hidden="true"
                    className="bg-gold absolute top-4 -left-[26px] size-2 rounded-full ring-4 ring-[color-mix(in_oklab,var(--color-ink-card)_70%,transparent)]"
                  />
                  <div className="border-cream/8 bg-cream/2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3">
                    <span className="text-gold-soft w-16 shrink-0 text-sm font-semibold tabular-nums">
                      {formatTime(new Date(`${booking.date}T${booking.time}:00`), locale)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {booking.clientName?.trim() ||
                          t("dashboard.professional.appointments.clientFallback")}
                      </span>
                      <span className="text-cream/50 block truncate text-xs">
                        {booking.serviceName ?? t(`venues.services.${booking.serviceId}`)}
                        {booking.clientPhone ? ` · ${booking.clientPhone}` : ""}
                      </span>
                    </span>
                    <AppointmentStatusBadge status={booking.displayStatus ?? "pending"} />
                    {(booking.displayStatus === "pending" ||
                      booking.displayStatus === "overdue") && (
                      <Button
                        size="sm"
                        onClick={() => confirm(booking)}
                        iconLeft={<Icon name="badge-check" className="size-4" />}
                      >
                        {t("dashboard.professional.appointments.confirm")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              className="mt-4"
              icon={<Icon name="inbox" className="size-8" />}
              title={t("dashboard.professional.agenda.empty")}
              body={t("dashboard.professional.agenda.emptyBody")}
            />
          )}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHead title={t("dashboard.professional.attention.title")} />
            {needsAttention > 0 ? (
              <ul className="mt-4 space-y-2">
                {overdue.length > 0 && (
                  <li className="border-gold/25 bg-gold/5 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
                    <Icon name="alert" className="text-gold size-4 shrink-0" />
                    <span className="min-w-0 flex-1 text-sm">
                      {t("dashboard.professional.attention.overdue", { count: overdue.length })}
                    </span>
                  </li>
                )}
                {refundRequests.length > 0 && (
                  <li className="border-gold/25 bg-gold/5 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
                    <Icon name="wallet" className="text-gold size-4 shrink-0" />
                    <span className="min-w-0 flex-1 text-sm">
                      {t("dashboard.professional.attention.refunds", {
                        count: refundRequests.length,
                      })}
                    </span>
                  </li>
                )}
                {awaiting.length > 0 && (
                  <li className="border-cream/10 bg-cream/3 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
                    <Icon name="clock" className="text-cream/60 size-4 shrink-0" />
                    <span className="min-w-0 flex-1 text-sm">
                      {t("dashboard.professional.attention.awaiting", { count: awaiting.length })}
                    </span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-cream/50 mt-4 text-sm leading-relaxed">
                {t("dashboard.professional.attention.clear")}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={() => onNavigate("appointments")}
            >
              {t("dashboard.professional.attention.review")}
            </Button>
          </Panel>

          <Panel>
            <PanelHead title={t("dashboard.professional.quick.title")} />
            <ul className="mt-4 space-y-2">
              {[
                { id: "schedule", icon: "clock" as const, labelKey: "dashboard.nav.schedule" },
                { id: "venues", icon: "store" as const, labelKey: "dashboard.nav.venues" },
                {
                  id: "earnings",
                  icon: "trending-up" as const,
                  labelKey: "dashboard.nav.earnings",
                },
                { id: "portfolio", icon: "images" as const, labelKey: "dashboard.nav.portfolio" },
                { id: "account", icon: "user" as const, labelKey: "dashboard.nav.account" },
              ].map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className="border-cream/8 bg-cream/2 hover:border-gold/40 flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-sm font-medium transition"
                  >
                    <Icon name={item.icon} className="text-gold size-4 shrink-0" />
                    <span className="min-w-0 flex-1">{t(item.labelKey)}</span>
                    <Icon name="arrow-right" className="text-cream/30 size-4 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {past.length > 0 && (
            <Panel>
              <PanelHead title={t("dashboard.professional.attention.recent")} />
              <ul className="mt-3 space-y-1.5">
                {past.slice(0, 3).map((booking) => (
                  <li key={booking.id} className="text-cream/60 flex items-center gap-2 text-xs">
                    <span className="tabular-nums">
                      {formatDate(new Date(`${booking.date}T00:00:00`), locale, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {booking.clientName?.trim() ||
                        t("dashboard.professional.appointments.clientFallback")}
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(booking.price, locale, "USD", { maximumFractionDigits: 0 })}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
