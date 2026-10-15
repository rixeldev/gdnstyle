"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs"
import { ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { VenueCard } from "@/components/venues/venue-card"
import { useCatalogReady, usePublicVenues } from "@/hooks/use-venues"
import { useFavorites } from "@/hooks/use-favorites"
import { useSession } from "@/libs/session"
import { toIntlLocale } from "@/utils/format"

/** Saved venues page: the account's favourited records, in the saved order. */
export function FavoritesPage() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const { ready: sessionReady, authenticated } = useSession()
  const { favorites, ready, count } = useFavorites()
  const allVenues = usePublicVenues()
  const catalogReady = useCatalogReady()
  // Only wait for the saved ids and the catalog once there is a session to read
  // them for; signed-out visitors go straight to the sign-in prompt.
  const loading = !sessionReady || (authenticated && (!ready || !catalogReady))

  const venues = useMemo(
    () =>
      [...allVenues]
        .filter((venue) => favorites.includes(venue.id))
        // Keep the order the user saved them in.
        .sort((a, b) => favorites.indexOf(a.id) - favorites.indexOf(b.id)),
    [allVenues, favorites],
  )

  const crumbs: Crumb[] = [
    { label: t("breadcrumbs.home"), href: "/" },
    { label: t("breadcrumbs.favorites") },
  ]

  return (
    <main id="main">
      <section className="relative overflow-hidden px-5 pt-24 pb-10 md:px-8 md:pt-28">
        <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(224,176,68,0.14),transparent_45%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(55,10,91,0.45),transparent_55%)]"
        />

        <div className="relative mx-auto max-w-6xl">
          <Breadcrumbs items={crumbs} className="mb-6" />

          <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
            {t("favorites.eyebrow")}
          </p>
          <h1 className="font-display mt-4 text-4xl leading-tight font-semibold md:text-5xl">
            {t("favorites.title")}
          </h1>
          <p className="text-cream/60 mt-3 max-w-2xl text-base">{t("favorites.supporting")}</p>

          {authenticated && ready && count > 0 && (
            <p className="border-gold/25 bg-gold/10 text-gold mt-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium">
              <Icon name="heart" className="fill-gold text-gold size-3.5" />
              {t("favorites.count", { count })}
            </p>
          )}
        </div>
      </section>

      <section className="px-5 pt-12 pb-24 md:px-8">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="bg-cream/5 h-80 animate-pulse rounded-3xl" />
              ))}
            </div>
          ) : !authenticated ? (
            <div className="border-cream/10 flex flex-col items-center gap-4 rounded-4xl border border-dashed px-6 py-16 text-center">
              <Icon name="heart" className="text-cream/20 size-9" />
              <h2 className="font-display text-xl font-semibold">{t("favorites.signInTitle")}</h2>
              <p className="text-cream/55 max-w-md text-sm leading-relaxed">
                {t("favorites.signInBody")}
              </p>
              <ButtonLink
                href={`/auth/login?next=${encodeURIComponent("/favorites")}`}
                size="sm"
                className="mt-2"
              >
                {t("favorites.signInCta")}
              </ButtonLink>
            </div>
          ) : venues.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="border-cream/10 flex flex-col items-center gap-4 rounded-4xl border border-dashed px-6 py-16 text-center">
              <Icon name="heart" className="text-cream/20 size-9" />
              <h2 className="font-display text-xl font-semibold">{t("favorites.emptyTitle")}</h2>
              <p className="text-cream/55 max-w-md text-sm leading-relaxed">
                {t("favorites.emptyBody")}
              </p>
              <ButtonLink href="/venues" size="sm" className="mt-2">
                {t("favorites.explore")}
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
