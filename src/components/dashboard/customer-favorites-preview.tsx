"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { VenueCard } from "@/components/venues/venue-card"
import type { Venue } from "@/constants/venues"
import { useFavorites } from "@/hooks/use-favorites"
import { usePublicVenues } from "@/hooks/use-venues"
import { toIntlLocale } from "@/utils/format"

/** Rows shown before the preview asks for more. */
const INITIAL_VISIBLE = 3
const STEP = 3

/**
 * Saved-venues preview under the appointment lists. Keeps the user's save
 * order and reveals more in steps instead of rendering everything at once.
 */
export function CustomerFavoritesPreview() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const { favorites, ready } = useFavorites()
  const allVenues = usePublicVenues()
  const [visible, setVisible] = useState(INITIAL_VISIBLE)

  // Map ids to catalog records, preserving the order the user saved them in.
  const saved = favorites
    .map((id) => allVenues.find((venue) => venue.id === id))
    .filter((venue): venue is Venue => Boolean(venue))

  if (!ready || saved.length === 0) return null

  const shown = saved.slice(0, visible)
  const remaining = saved.length - shown.length

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{t("dashboard.customer.favorites")}</h2>
        <Link
          href="/favorites"
          className="text-gold inline-flex items-center gap-1.5 text-sm underline-offset-4 transition hover:underline"
        >
          {t("dashboard.customer.manageFavorites")}
          <Icon name="arrow-right" className="size-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((venue) => (
          <VenueCard key={venue.id} venue={venue} locale={locale} />
        ))}
      </div>

      {remaining > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setVisible((count) => count + STEP)}>
            {t("dashboard.customer.loadMore", { count: remaining })}
          </Button>
        </div>
      )}
    </section>
  )
}
