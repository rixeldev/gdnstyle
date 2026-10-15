"use client"

import { useTranslation } from "react-i18next"

import { Icon, type IconProps } from "@/components/ui/icon"
import { useFavorites } from "@/hooks/use-favorites"
import { useBookings } from "@/hooks/use-bookings"

interface StatTile {
  key: string
  labelKey: string
  icon: IconProps["name"]
  /** `null` while the source data is still loading. */
  count: number | null
}

/**
 * Compact counters above the appointment lists: totals at a glance without
 * duplicating the lists shown below (upcoming, history, favorites).
 */
export function CustomerSummaryStats() {
  const { t } = useTranslation()
  const { bookings, upcoming, past, ready } = useBookings()
  const { count: favoritesCount, ready: favoritesReady } = useFavorites()

  const stats: StatTile[] = [
    {
      key: "total",
      labelKey: "dashboard.customer.statTotal",
      icon: "calendar",
      count: ready ? bookings.length : null,
    },
    {
      key: "upcoming",
      labelKey: "dashboard.customer.statUpcoming",
      icon: "clock",
      count: ready ? upcoming.length : null,
    },
    {
      key: "completed",
      labelKey: "dashboard.customer.statCompleted",
      icon: "check",
      count: ready ? past.length : null,
    },
    {
      key: "favorites",
      labelKey: "dashboard.customer.statFavorites",
      icon: "star",
      count: favoritesReady ? favoritesCount : null,
    },
  ]

  return (
    <section
      aria-label={t("dashboard.customer.summaryLabel")}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {stats.map((stat) => (
        <div
          key={stat.key}
          className="border-cream/10 bg-ink-card flex items-center gap-4 rounded-3xl border p-5"
        >
          <span className="border-gold/25 bg-gold/10 text-gold flex size-11 shrink-0 items-center justify-center rounded-2xl border">
            <Icon name={stat.icon} className="size-5" />
          </span>
          <div className="min-w-0">
            {stat.count === null ? (
              <div aria-hidden="true" className="bg-cream/5 h-7 w-10 animate-pulse rounded-md" />
            ) : (
              <p className="font-display text-2xl leading-none">{stat.count}</p>
            )}
            <p className="text-cream/55 mt-1.5 truncate text-xs">{t(stat.labelKey)}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
