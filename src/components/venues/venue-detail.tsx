"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"

import { BookButton } from "@/components/venues/book-button"
import { Icon } from "@/components/ui/icon"
import { CATEGORIES } from "@/constants/categories"
import type { Venue } from "@/constants/venues"
import { cn } from "@/utils/cn"
import { formatCurrency, formatNumber, toIntlLocale } from "@/utils/format"

interface VenueDetailProps {
  venue: Venue
}

/** Single venue page: full info plus the session-gated booking card. */
export function VenueDetail({ venue }: VenueDetailProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language ?? "es")
  const category = CATEGORIES.find((item) => item.id === venue.categoryId)
  const rating = formatNumber(venue.rating, locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const price = formatCurrency(venue.priceFrom, locale, "DOP", { maximumFractionDigits: 0 })

  return (
    <main id="main">
      <section className="relative overflow-hidden px-5 pt-28 pb-20 md:px-8 md:pt-32">
        <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(224,176,68,0.12),transparent_45%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(55,10,91,0.45),transparent_55%)]"
        />

        <div className="relative mx-auto max-w-6xl">
          <Link
            href="/locales"
            className="text-cream/55 hover:text-gold inline-flex items-center gap-2 text-sm underline-offset-4 transition hover:underline"
          >
            <Icon name="arrow-left" className="size-4" />
            {t("venues.detail.back")}
          </Link>

          <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-start">
            <div>
              {category && (
                <span className="border-gold/25 bg-ink/70 text-gold inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-[0.16em] uppercase backdrop-blur-sm">
                  <Icon name={category.icon} className="size-3.5" />
                  {t(category.labelKey)}
                </span>
              )}

              <h1 className="font-display mt-4 text-4xl leading-tight font-semibold md:text-5xl">
                {venue.name}
              </h1>

              <p className="text-cream/60 mt-3 flex items-center gap-2 text-sm">
                <Icon name="map-pin" className="text-gold size-4 shrink-0" />
                {venue.area}, {venue.city}
              </p>

              <div className="mt-5 flex items-center gap-2 text-sm">
                <span
                  role="img"
                  aria-label={t("landing.testimonials.starsLabel", {
                    count: Math.round(venue.rating),
                  })}
                  className="flex items-center gap-0.5"
                >
                  {[0, 1, 2, 3, 4].map((index) => (
                    <Icon
                      key={index}
                      name="star"
                      className={cn(
                        "size-4",
                        index < Math.round(venue.rating) ? "fill-gold text-gold" : "text-cream/20",
                      )}
                    />
                  ))}
                </span>
                <span className="text-cream font-semibold">{rating}</span>
                <span className="text-cream/45">({formatNumber(venue.reviews, locale)})</span>
              </div>

              <p className="text-cream/75 mt-5 text-base font-medium">
                {t("directory.priceFrom", { price })}
              </p>

              <div className="mt-8">
                <p className="font-display text-lg font-semibold">
                  {t("venues.detail.servicesTitle")}
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {venue.services.map((service) => (
                    <li
                      key={service}
                      className="border-cream/10 bg-cream/3 text-cream/80 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm"
                    >
                      <Icon name="check" className="text-gold size-3.5" />
                      {t(`venues.services.${service}`)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <aside className="lg:sticky lg:top-24">
              <div className="border-gold/25 bg-ink-card/85 shadow-luxe rounded-4xl border p-6 sm:p-8">
                <p className="font-display text-2xl font-semibold">
                  {t("venues.detail.bookTitle")}
                </p>
                <p className="text-cream/60 mt-2 text-sm leading-relaxed">
                  {t("venues.detail.bookSupporting")}
                </p>
                <p className="text-cream/45 mt-5 text-xs">{t("venues.detail.signInHint")}</p>
                <div className="mt-3">
                  <BookButton venueId={venue.id} venuePage size="lg" fullWidth />
                </div>

                <ul className="text-cream/55 border-cream/10 mt-6 space-y-2.5 border-t pt-5 text-xs">
                  <li className="flex items-center gap-2.5">
                    <Icon name="shield" className="text-gold size-4 shrink-0" />
                    {t("landing.hero.trust.secure")}
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Icon name="calendar" className="text-gold size-4 shrink-0" />
                    {t("landing.hero.trust.cancel")}
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Icon name="bell" className="text-gold size-4 shrink-0" />
                    {t("landing.hero.trust.reminders")}
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
