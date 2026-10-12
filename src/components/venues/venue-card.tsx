"use client"

import Image from "next/image"
import { useTranslation } from "react-i18next"

import { BookButton } from "@/components/venues/book-button"
import { FavoriteButton } from "@/components/venues/favorite-button"
import { Icon } from "@/components/ui/icon"
import { CATEGORIES } from "@/constants/categories"
import { categoryCover } from "@/constants/covers"
import type { Venue } from "@/constants/venues"
import { cn } from "@/utils/cn"
import { formatCurrency, formatNumber } from "@/utils/format"

interface VenueCardProps {
  venue: Venue
  /** Intl locale (e.g. es-DO / en-US) for number and currency formatting. */
  locale: string
}

export function VenueCard({ venue, locale }: VenueCardProps) {
  const { t } = useTranslation()
  const category = CATEGORIES.find((item) => item.id === venue.categoryId)
  const rating = formatNumber(venue.rating, locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const price = formatCurrency(venue.priceFrom, locale, "DOP", { maximumFractionDigits: 0 })

  return (
    <article className="border-cream/10 bg-ink-card group hover:border-gold/40 flex h-full flex-col overflow-hidden rounded-3xl border transition duration-300 hover:-translate-y-1">
      <div className="relative h-40 overflow-hidden">
        <div
          aria-hidden="true"
          className={cn(
            "via-ink-card to-ink-card absolute inset-0 bg-linear-to-br",
            categoryCover(venue.categoryId),
          )}
        />
        <Image
          src={venue.image}
          alt={t("directory.venueImageAlt", { name: venue.name })}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div
          aria-hidden="true"
          className="from-ink-card via-ink-card/20 absolute inset-0 bg-linear-to-t to-transparent"
        />

        <FavoriteButton venueId={venue.id} className="absolute top-3 left-3 z-10" />

        {venue.featured && (
          <span className="bg-gold text-gold-ink absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase">
            {t("directory.featured")}
          </span>
        )}

        {category && (
          <span className="border-gold/25 bg-ink/70 text-gold absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-medium tracking-[0.16em] uppercase backdrop-blur-sm">
            <Icon name={category.icon} className="size-3" />
            {t(category.labelKey)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg leading-snug">{venue.name}</h3>

        <p className="text-cream/50 mt-1.5 flex items-center gap-1.5 text-xs">
          <Icon name="map-pin" className="text-gold size-3.5 shrink-0" />
          {venue.area}, {venue.city}
        </p>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            role="img"
            aria-label={t("landing.testimonials.starsLabel", { count: Math.round(venue.rating) })}
            className="flex items-center gap-0.5"
          >
            {[0, 1, 2, 3, 4].map((index) => (
              <Icon
                key={index}
                name="star"
                className={cn(
                  "size-3",
                  index < Math.round(venue.rating) ? "fill-gold text-gold" : "text-cream/20",
                )}
              />
            ))}
          </span>
          <span className="text-cream font-semibold">{rating}</span>
          <span className="text-cream/40">({formatNumber(venue.reviews, locale)})</span>
        </div>

        <ul className="mt-3 mb-5 flex flex-wrap gap-1.5">
          {venue.services.slice(0, 3).map((service) => (
            <li
              key={service}
              className="border-cream/10 text-cream/55 rounded-full border px-2.5 py-1 text-[11px]"
            >
              {t(`venues.services.${service}`)}
            </li>
          ))}
        </ul>

        <div className="border-cream/10 mt-auto flex items-center justify-between gap-3 border-t pt-4">
          <span className="text-cream/45 text-xs">{t("directory.priceFrom", { price })}</span>
          <BookButton venueId={venue.id} />
        </div>
      </div>
    </article>
  )
}
