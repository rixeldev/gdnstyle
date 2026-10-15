"use client"

import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"

import { BookingForm } from "@/components/venues/booking-form"
import { FavoriteButton } from "@/components/venues/favorite-button"
import { ReviewSection } from "@/components/venues/review-section"
import { VenueMap } from "@/components/venues/venue-map"
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs"
import { Icon } from "@/components/ui/icon"
import { getCategoryById } from "@/constants/categories"
import { categoryCover } from "@/constants/covers"
import { getVenueProfessionals } from "@/constants/professionals"
import type { Venue } from "@/constants/venues"
import { cn } from "@/utils/cn"
import { formatCurrency, formatNumber, toIntlLocale } from "@/utils/format"
import { initials } from "@/utils/initials"
import { venueLocationLabel } from "@/utils/venue"
import { venueServiceOptions } from "@/libs/marketplace/venue-services"

interface VenueDetailProps {
  venue: Venue
}

/** Single venue page: gallery, services, team, reviews, map and booking card. */
export function VenueDetail({ venue }: VenueDetailProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const category = getCategoryById(venue.categoryId)
  const categoryLabel = category ? t(category.labelKey) : (venue.categoryNames?.[0] ?? "")
  const databaseProfessionals = venue.professionals ?? []
  const professionals =
    databaseProfessionals.length > 0
      ? databaseProfessionals.map((professional) => ({
          id: professional.id,
          name: professional.name,
          meta: (professional.specialties ?? []).join(", "),
        }))
      : getVenueProfessionals(venue).map((professional) => ({
          id: professional.id,
          name: professional.name,
          meta: `${t(professional.specialtyKey)} · ${t("venues.professionals.experienceYears", {
            count: professional.experience,
          })}`,
        }))
  const serviceOptions = venueServiceOptions(venue).map((option) => ({
    ...option,
    displayLabel: option.label ?? (option.labelKey ? t(option.labelKey) : ""),
  }))
  const hasCoords = venue.hasCoords !== false
  const galleryPhotos = venue.gallery.length > 0 ? venue.gallery : [""]
  const rating = formatNumber(venue.rating, locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const priceFrom = formatCurrency(venue.priceFrom, locale, "USD", { maximumFractionDigits: 0 })
  const mapPoints = [{ id: venue.id, name: venue.name, lat: venue.lat, lon: venue.lon }]
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lon}`

  const crumbs: Crumb[] = [
    { label: t("breadcrumbs.home"), href: "/" },
    { label: t("breadcrumbs.directory"), href: "/venues" },
    { label: venue.name },
  ]

  const metaChip =
    "border-cream/12 bg-cream/4 text-cream/70 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium"

  return (
    <main id="main">
      <section className="relative overflow-hidden px-5 pt-24 pb-20 md:px-8 md:pt-28">
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
          <Breadcrumbs items={crumbs} className="mb-8" />

          <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-start">
            <div className="space-y-10">
              {/* Gallery */}
              <div>
                <p className="text-cream/40 mb-3 text-[11px] tracking-[0.2em] uppercase">
                  {t("venues.detail.galleryTitle")}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {galleryPhotos.map((photo, index) => (
                    <div
                      key={`${venue.id}-photo-${index}`}
                      className={cn(
                        "border-cream/10 relative h-32 overflow-hidden rounded-2xl border sm:h-36",
                        index === 0 && "col-span-2 sm:col-span-1",
                      )}
                    >
                      <div
                        aria-hidden="true"
                        className={cn(
                          "via-ink-card to-ink-card absolute inset-0 bg-linear-to-br",
                          categoryCover(venue.categoryId),
                        )}
                      />
                      {photo && (
                        <Image
                          src={photo}
                          alt={t("venues.detail.galleryPhotoAlt", {
                            name: venue.name,
                            index: index + 1,
                          })}
                          fill
                          sizes="(max-width: 640px) 100vw, 33vw"
                          className="object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Header */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {categoryLabel && (
                    <span className="border-gold/25 bg-ink/70 text-gold inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-[0.16em] uppercase backdrop-blur-sm">
                      <Icon name={category?.icon ?? "sparkles"} className="size-3.5" />
                      {categoryLabel}
                    </span>
                  )}
                  <span className="text-gold border-gold/25 bg-gold/10 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-[0.16em] uppercase">
                    <Icon name="badge-check" className="size-3.5" />
                    {t("venues.detail.verified")}
                  </span>
                  <span className="border-cream/15 bg-cream/3 text-cream/55 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] tracking-[0.16em] uppercase">
                    <Icon name="clock" className="size-3.5" />
                    {t("venues.detail.respondsIn")}
                  </span>
                </div>

                <h1 className="font-display mt-4 text-4xl leading-tight font-semibold md:text-5xl">
                  {venue.name}
                </h1>

                <p className="text-cream/60 mt-3 flex items-center gap-2 text-sm">
                  <Icon name="map-pin" className="text-gold size-4 shrink-0" />
                  {venueLocationLabel(venue)}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="flex items-center gap-2 text-sm">
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
                            index < Math.round(venue.rating)
                              ? "fill-gold text-gold"
                              : "text-cream/20",
                          )}
                        />
                      ))}
                    </span>
                    <span className="text-cream font-semibold">{rating}</span>
                    <span className="text-cream/45">({formatNumber(venue.reviews, locale)})</span>
                  </span>

                  <span className="text-cream/75 text-sm font-medium">
                    {t("directory.priceFrom", { price: priceFrom })}
                  </span>
                </div>

                <div className="mt-5">
                  <FavoriteButton venueId={venue.id} variant="inline" />
                </div>

                {(venue.description || venue.phone || venue.whatsapp || venue.instagram) && (
                  <div className="mt-6 space-y-4">
                    {venue.description && (
                      <p className="text-cream/70 max-w-2xl text-sm leading-relaxed">
                        {venue.description}
                      </p>
                    )}
                    {(venue.phone || venue.whatsapp || venue.instagram) && (
                      <div className="flex flex-wrap gap-2">
                        {venue.phone && (
                          <a href={`tel:${venue.phone}`} className={metaChip}>
                            <Icon name="phone" className="text-gold size-3.5" />
                            {venue.phone}
                          </a>
                        )}
                        {venue.whatsapp && (
                          <a
                            href={`https://wa.me/${venue.whatsapp.replace(/[^\d]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className={metaChip}
                          >
                            <Icon name="phone" className="text-gold size-3.5" />
                            WhatsApp
                          </a>
                        )}
                        {venue.instagram && (
                          <a
                            href={`https://instagram.com/${venue.instagram.replace(/^@/, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className={metaChip}
                          >
                            <Icon name="globe" className="text-gold size-3.5" />
                            {venue.instagram.startsWith("@")
                              ? venue.instagram
                              : `@${venue.instagram}`}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Services */}
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {t("venues.detail.servicesTitle")}
                </h2>
                <ul className="border-cream/10 bg-cream/2 divide-cream/10 mt-4 divide-y rounded-3xl border">
                  {serviceOptions.map((service) => (
                    <li
                      key={service.id}
                      className="flex items-center justify-between gap-4 px-5 py-3.5"
                    >
                      <span className="text-cream/85 flex items-center gap-2.5 text-sm">
                        <Icon name="check" className="text-gold size-4 shrink-0" />
                        {service.displayLabel}
                      </span>
                      <span className="flex shrink-0 items-center gap-4 text-sm">
                        <span className="text-cream/40 text-xs">
                          {t("venues.booking.duration", { count: service.durationMin })}
                        </span>
                        <span className="text-cream font-semibold">
                          {formatCurrency(service.price, locale, "USD", {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Professionals */}
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {t("venues.professionals.title")}
                </h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {professionals.map((professional) => (
                    <Link
                      key={professional.id}
                      href={`/professionals/${professional.id}`}
                      className="border-cream/10 bg-cream/2 hover:border-gold/40 flex min-w-60 items-center gap-3 rounded-2xl border px-4 py-3 transition"
                    >
                      <span className="border-gold/30 bg-gold/10 text-gold flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
                        {initials(professional.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="text-cream block text-sm font-semibold">
                          {professional.name}
                        </span>
                        <span className="text-cream/50 block text-xs">{professional.meta}</span>
                      </span>
                      <Icon name="arrow-right" className="text-gold ml-auto size-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {t("venues.detail.scheduleTitle")}
                </h2>
                <p className="text-cream/50 mt-1 text-sm">{t("venues.detail.scheduleHint")}</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="border-cream/10 bg-cream/2 rounded-2xl border px-5 py-4">
                    <dt className="text-cream/45 text-xs tracking-[0.14em] uppercase">
                      {t("venues.detail.scheduleWeekLabel")}
                    </dt>
                    <dd className="text-cream mt-1.5 text-sm font-medium">
                      {t("venues.detail.scheduleHours")}
                    </dd>
                  </div>
                  <div className="border-cream/10 bg-cream/2 rounded-2xl border px-4 py-3">
                    <dt className="text-cream/45 text-xs tracking-[0.16em] uppercase">
                      {t("venues.detail.scheduleClosedLabel")}
                    </dt>
                    <dd className="text-cream/70 mt-1.5 text-sm font-medium">
                      {t("venues.detail.scheduleClosed")}
                    </dd>
                  </div>
                </dl>
                <p className="text-cream/40 mt-3 text-xs">{t("venues.detail.scheduleNote")}</p>
              </div>

              {/* Reviews */}
              <ReviewSection venue={venue} locale={locale} />

              {/* Map */}
              {hasCoords && (
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <h2 className="font-display text-xl font-semibold">
                      {t("venues.detail.mapTitle")}
                    </h2>
                    <a
                      href={directionsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gold inline-flex items-center gap-1.5 text-sm underline-offset-4 transition hover:underline"
                    >
                      {t("venues.detail.mapDirections")}
                      <Icon name="arrow-up-right" className="size-4" />
                    </a>
                  </div>
                  <VenueMap
                    points={mapPoints}
                    label={t("venues.detail.mapHint", { name: venue.name })}
                    className="border-cream/10 mt-4 h-75 w-full overflow-hidden rounded-4xl border"
                  />
                </div>
              )}
            </div>

            {/* Booking card */}
            <aside className="lg:sticky lg:top-24">
              <div className="border-gold/25 bg-ink-card/85 shadow-luxe rounded-4xl border p-6 sm:p-8">
                <p className="font-display text-2xl font-semibold">
                  {t("venues.detail.bookTitle")}
                </p>
                <p className="text-cream/60 mt-2 text-sm leading-relaxed">
                  {t("venues.detail.bookSupporting")}
                </p>

                {/* Suspense: BookingForm reads `useSearchParams` for the
                    `?service=` deep link (e.g. "Book again"). */}
                <Suspense
                  fallback={
                    <div
                      aria-hidden="true"
                      className="bg-cream/5 mt-5 h-64 animate-pulse rounded-2xl"
                    />
                  }
                >
                  <BookingForm venue={venue} locale={locale} />
                </Suspense>

                <ul className="text-cream/55 border-cream/10 mt-6 space-y-2.5 border-t pt-5 text-xs">
                  <li className="flex items-center gap-2.5">
                    <Icon name="shield" className="text-gold size-4 shrink-0" />
                    {t("landing.hero.trust.secure")}
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Icon name="calendar" className="text-gold size-4 shrink-0" />
                    {t("venues.detail.cancelPolicy")}
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
