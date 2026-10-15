"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"

import { FavoriteButton } from "@/components/venues/favorite-button"
import { Icon } from "@/components/ui/icon"
import { getCategoryById } from "@/constants/categories"
import { categoryCover } from "@/constants/covers"
import type { Venue } from "@/constants/venues"
import { hasSession, useSession } from "@/libs/session"
import { cn } from "@/utils/cn"
import { formatCurrency, formatNumber } from "@/utils/format"
import { venueLocationLabel } from "@/utils/venue"

interface VenueCardProps {
  venue: Venue
  /** Intl locale (e.g. es-US / en-US) for number and currency formatting. */
  locale: string
}

export function VenueCard({ venue, locale }: VenueCardProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useSession()
  const [busy, setBusy] = useState(false)
  const professional = user?.role === "professional"
  const href = `/venues/${venue.id}`
  /** The card itself is the booking trigger, so it carries the old button label. */
  const actionLabel = professional ? t("venues.viewVenue") : t("directory.book")
  const category = getCategoryById(venue.categoryId)
  const categoryLabel = category ? t(category.labelKey) : (venue.categoryNames?.[0] ?? "")
  const serviceLabels =
    venue.serviceList && venue.serviceList.length > 0
      ? venue.serviceList.slice(0, 3).map((service) => service.name)
      : venue.services.slice(0, 3).map((service) => t(`venues.services.${service}`))
  const rating = formatNumber(venue.rating, locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const price = formatCurrency(venue.priceFrom, locale, "USD", { maximumFractionDigits: 0 })

  /**
   * The card is the booking trigger. Without an account the visitor signs in
   * first and is returned to the venue afterwards via `next`. Professional
   * accounts never book, so for them the card just opens the venue (handled by
   * the plain link, no interception).
   */
  async function handleOpen(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    if (professional) return
    event.preventDefault()
    if (busy) return
    setBusy(true)
    if (!(await hasSession())) {
      router.push(`/auth/login?next=${encodeURIComponent(href)}`)
      setBusy(false)
      return
    }
    router.push(href)
    setBusy(false)
  }

  return (
    <article className="border-cream/10 bg-ink-card group hover:border-gold/40 relative flex h-full flex-col overflow-hidden rounded-3xl border transition duration-300 hover:-translate-y-1">
      <div className="relative h-40 overflow-hidden">
        <div
          aria-hidden="true"
          className={cn(
            "via-ink-card to-ink-card absolute inset-0 bg-linear-to-br",
            categoryCover(venue.categoryId),
          )}
        />
        {venue.image && (
          <Image
            src={venue.image}
            alt={t("directory.venueImageAlt", { name: venue.name })}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        )}
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

        {categoryLabel && (
          <span className="border-gold/25 bg-ink/70 text-gold absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-medium tracking-[0.16em] uppercase backdrop-blur-sm">
            <Icon name={category?.icon ?? "sparkles"} className="size-3" />
            {categoryLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg leading-snug">{venue.name}</h3>

        <p className="text-cream/50 mt-1.5 flex items-center gap-1.5 text-xs">
          <Icon name="map-pin" className="text-gold size-3.5 shrink-0" />
          {venueLocationLabel(venue)}
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
          {serviceLabels.map((label, index) => (
            <li
              key={`${label}-${index}`}
              className="border-cream/10 text-cream/55 rounded-full border px-2.5 py-1 text-[11px]"
            >
              {label}
            </li>
          ))}
        </ul>

        <div className="border-cream/10 mt-auto flex items-center justify-between gap-3 border-t pt-4">
          <span className="text-cream/45 text-xs">{t("directory.priceFrom", { price })}</span>
          <span
            aria-hidden="true"
            className="text-gold inline-flex items-center gap-1 text-xs font-semibold"
          >
            {actionLabel}
            <Icon name="arrow-up-right" className="size-3.5" />
          </span>
        </div>
      </div>

      {/* Stretched link: the whole card opens the venue (and books it). It sits
          below FavoriteButton (z-10) so the heart keeps working on its own. */}
      <Link
        href={href}
        onClick={handleOpen}
        aria-label={`${actionLabel}: ${venue.name}`}
        className="focus-visible:outline-gold absolute inset-0 rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]"
      />
    </article>
  )
}
