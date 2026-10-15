"use client"

import Image from "next/image"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import { VenueMap } from "@/components/venues/venue-map"
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs"
import { ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import type { IconName } from "@/interfaces/common"
import {
  providerSocialLinks,
  type ProviderProfile,
  type ProviderReviewItem,
  type ProviderSocials,
} from "@/constants/provider-profile"
import { getCategoryById } from "@/constants/categories"
import { cn } from "@/utils/cn"
import { formatCurrency, formatNumber, toIntlLocale } from "@/utils/format"
import { isOptimizableImage } from "@/utils/image"
import { initials } from "@/utils/initials"

interface ProviderProfileViewProps {
  profile: ProviderProfile
}

const SOCIAL_ICONS: Record<keyof ProviderSocials, IconName> = {
  facebook: "facebook",
  instagram: "instagram",
  tiktok: "tiktok",
  twitter: "twitter",
  youtube: "youtube",
  whatsapp: "whatsapp",
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5", className)}>
      {[0, 1, 2, 3, 4].map((index) => (
        <Icon
          key={index}
          name="star"
          className={cn(
            "size-3.5",
            index < Math.round(rating) ? "fill-gold text-gold" : "text-cream/20",
          )}
        />
      ))}
    </span>
  )
}

/** Public professional profile: services, portfolio, venues, socials, reviews. */
export function ProviderProfileView({ profile }: ProviderProfileViewProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const rating = formatNumber(profile.rating, locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const mapPoints = profile.venues
    .filter((venue) => venue.hasCoords)
    .map((venue) => ({
      id: venue.id,
      name: venue.name,
      lat: venue.lat,
      lon: venue.lon,
      href: `/venues/${venue.id}`,
    }))
  const categoryChips = profile.categoryIds
    .map((id) => getCategoryById(id))
    .filter((category): category is NonNullable<typeof category> => Boolean(category))
    .slice(0, 4)

  const crumbs: Crumb[] = [
    { label: t("breadcrumbs.home"), href: "/" },
    { label: t("breadcrumbs.professionals"), href: "/venues" },
    { label: profile.name },
  ]

  const contactChip =
    "border-cream/12 bg-cream/4 text-cream/70 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium hover:text-cream transition"

  const callDigits = (profile.phone ?? "").replace(/[^\d]/g, "")
  const whatsappDigits = (profile.socials.whatsapp ?? "").replace(/[^\d]/g, "")
  // WhatsApp is surfaced as a contact action below, so keep it out of the
  // social row to avoid rendering the same link twice.
  const socials = providerSocialLinks(profile.socials).filter((social) => social.key !== "whatsapp")

  return (
    <main id="main">
      <section className="relative overflow-hidden px-5 pt-24 pb-20 md:px-8 md:pt-28">
        <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(224,176,68,0.12),transparent_45%)]"
        />

        <div className="relative mx-auto max-w-6xl">
          <Breadcrumbs items={crumbs} className="mb-8" />

          <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,22rem)] lg:items-start">
            <div className="space-y-10">
              {/* Header */}
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="border-gold/30 bg-gold/10 text-gold relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border text-2xl font-semibold">
                  {profile.photo ? (
                    <Image
                      src={profile.photo}
                      alt={profile.name}
                      fill
                      sizes="96px"
                      unoptimized={!isOptimizableImage(profile.photo)}
                      className="object-cover"
                    />
                  ) : (
                    initials(profile.name)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {categoryChips.map((category) => (
                      <span
                        key={category.id}
                        className="border-gold/25 bg-ink/70 text-gold inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-[0.16em] uppercase backdrop-blur-sm"
                      >
                        <Icon name={category.icon} className="size-3.5" />
                        {t(category.labelKey)}
                      </span>
                    ))}
                    {profile.verified && (
                      <span className="text-gold border-gold/25 bg-gold/10 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-[0.16em] uppercase">
                        <Icon name="badge-check" className="size-3.5" />
                        {t("professionals.verified")}
                      </span>
                    )}
                  </div>

                  <h1 className="font-display mt-4 text-4xl leading-tight font-semibold md:text-5xl">
                    {profile.name}
                  </h1>

                  {profile.businessName && profile.businessName !== profile.name && (
                    <p className="text-cream/60 mt-2 text-sm">{profile.businessName}</p>
                  )}

                  {(profile.address || profile.city) && (
                    <p className="text-cream/60 mt-3 flex items-center gap-2 text-sm">
                      <Icon name="map-pin" className="text-gold size-4 shrink-0" />
                      {[profile.address, profile.city, profile.country].filter(Boolean).join(", ")}
                    </p>
                  )}

                  {profile.reviews > 0 && (
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="flex items-center gap-2 text-sm">
                        <span
                          role="img"
                          aria-label={t("landing.testimonials.starsLabel", {
                            count: Math.round(profile.rating),
                          })}
                        >
                          <Stars rating={profile.rating} />
                        </span>
                        <span className="text-cream font-semibold">{rating}</span>
                        <span className="text-cream/45">
                          ({formatNumber(profile.reviews, locale)})
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Contact actions */}
                  <div className="mt-6 flex flex-wrap gap-2">
                    {callDigits && (
                      <a href={`tel:${callDigits}`} className={contactChip}>
                        <Icon name="phone" className="text-gold size-3.5" />
                        {t("professionals.call")}
                      </a>
                    )}
                    {whatsappDigits && (
                      <a
                        href={`https://wa.me/${whatsappDigits}`}
                        target="_blank"
                        rel="noreferrer"
                        className={contactChip}
                      >
                        <Icon name="whatsapp" className="text-gold size-3.5" />
                        {t("professionals.whatsapp")}
                      </a>
                    )}
                    {profile.email && (
                      <a href={`mailto:${profile.email}`} className={contactChip}>
                        <Icon name="mail" className="text-gold size-3.5" />
                        {t("professionals.email")}
                      </a>
                    )}
                  </div>

                  {/* Social links */}
                  {socials.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {socials.map((social) => (
                        <a
                          key={social.key}
                          href={social.href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={social.label}
                          className={contactChip}
                        >
                          <Icon name={SOCIAL_ICONS[social.key]} className="text-gold size-3.5" />
                          {social.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Services */}
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {t("professionals.servicesTitle")}
                </h2>
                {profile.services.length === 0 ? (
                  <p className="text-cream/50 mt-3 text-sm">{t("professionals.servicesEmpty")}</p>
                ) : (
                  <ul className="border-cream/10 bg-cream/2 divide-cream/10 mt-4 divide-y rounded-3xl border">
                    {profile.services.map((service) => (
                      <li
                        key={service.id}
                        className="flex items-start justify-between gap-4 px-5 py-3.5"
                      >
                        <span className="min-w-0">
                          <span className="text-cream/90 block text-sm font-medium">
                            {service.name}
                          </span>
                          {service.description && (
                            <span className="text-cream/50 mt-0.5 block text-xs">
                              {service.description}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-4 text-sm">
                          {service.durationMin > 0 && (
                            <span className="text-cream/40 text-xs">
                              {t("venues.booking.duration", { count: service.durationMin })}
                            </span>
                          )}
                          <span className="text-cream font-semibold">
                            {formatCurrency(service.price, locale, "USD", {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Portfolio */}
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {t("professionals.portfolioTitle")}
                </h2>
                {profile.portfolio.length === 0 ? (
                  <p className="text-cream/50 mt-3 text-sm">{t("professionals.portfolioEmpty")}</p>
                ) : (
                  <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {profile.portfolio.map((item) => (
                      <li
                        key={item.id}
                        className="border-cream/10 bg-ink-card group relative h-40 overflow-hidden rounded-2xl border"
                      >
                        <Image
                          src={item.imageUrl}
                          alt={
                            item.title ??
                            t("professionals.portfolioPhotoAlt", { name: profile.name })
                          }
                          fill
                          sizes="(max-width: 640px) 50vw, 33vw"
                          unoptimized={!isOptimizableImage(item.imageUrl)}
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="from-ink/90 pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t to-transparent p-3">
                          {item.title && (
                            <p className="text-cream line-clamp-1 text-xs font-semibold">
                              {item.title}
                            </p>
                          )}
                          <p className="text-cream/60 mt-0.5 flex items-center gap-3 text-[11px]">
                            <span className="inline-flex items-center gap-1">
                              <Icon name="heart" className="size-3" />
                              {formatNumber(item.likes, locale)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Icon name="list" className="size-3" />
                              {formatNumber(item.comments, locale)}
                            </span>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Venues */}
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {t("professionals.venuesTitle")}
                </h2>
                {profile.venues.length === 0 ? (
                  <p className="text-cream/50 mt-3 text-sm">{t("professionals.venuesEmpty")}</p>
                ) : (
                  <>
                    <ul className="mt-4 flex flex-wrap gap-3">
                      {profile.venues.map((venue) => (
                        <li key={venue.id}>
                          <Link
                            href={`/venues/${venue.id}`}
                            className="border-cream/10 bg-cream/2 hover:border-gold/40 flex min-w-60 items-center gap-3 rounded-2xl border px-4 py-3 transition"
                          >
                            <span className="border-gold/30 bg-gold/10 text-gold flex size-10 shrink-0 items-center justify-center rounded-xl border">
                              <Icon name="map-pin" className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="text-cream block text-sm font-semibold">
                                {venue.name}
                              </span>
                              <span className="text-cream/50 block text-xs">
                                {[venue.address, venue.city].filter(Boolean).join(", ")}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>

                    {mapPoints.length > 0 && (
                      <VenueMap
                        points={mapPoints}
                        label={t("professionals.mapHint", { name: profile.name })}
                        className="border-cream/10 mt-4 h-75 w-full overflow-hidden rounded-4xl border"
                      />
                    )}
                  </>
                )}
              </div>

              {/* Reviews */}
              <div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">
                      {t("professionals.reviewsTitle")}
                    </h2>
                    <p className="text-cream/50 mt-1 text-sm">
                      {t("professionals.reviewsSupporting")}
                    </p>
                  </div>
                  {profile.reviews > 0 && (
                    <p className="text-cream/70 flex items-center gap-2 text-sm">
                      <Stars rating={profile.rating} />
                      <span className="text-cream font-semibold">{rating}</span>
                    </p>
                  )}
                </div>

                {profile.reviewsList.length === 0 ? (
                  <p className="border-cream/10 text-cream/55 mt-4 rounded-3xl border border-dashed p-5 text-sm">
                    {t("professionals.reviewsEmpty")}
                  </p>
                ) : (
                  <ul className="border-cream/10 bg-cream/2 divide-cream/10 mt-4 divide-y rounded-3xl border">
                    {profile.reviewsList.map((review) => (
                      <ReviewRow key={review.id} review={review} />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Side card */}
            <aside className="lg:sticky lg:top-24">
              <div className="border-gold/25 bg-ink-card/85 shadow-luxe rounded-4xl border p-6 sm:p-8">
                <p className="font-display text-2xl font-semibold">
                  {t("professionals.bookTitle", { name: profile.name })}
                </p>
                <p className="text-cream/60 mt-2 text-sm leading-relaxed">
                  {t("professionals.bookSupporting")}
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  {profile.venues[0] ? (
                    <ButtonLink href={`/venues/${profile.venues[0].id}`} className="w-full">
                      {t("professionals.bookCta")}
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/venues" className="w-full">
                      {t("professionals.exploreCta")}
                    </ButtonLink>
                  )}
                  {callDigits && (
                    <ButtonLink
                      href={`tel:${callDigits}`}
                      variant="outline"
                      className="w-full"
                      iconLeft={<Icon name="phone" className="size-4" />}
                    >
                      {t("professionals.call")}
                    </ButtonLink>
                  )}
                </div>

                <ul className="text-cream/55 border-cream/10 mt-6 space-y-2.5 border-t pt-5 text-xs">
                  <li className="flex items-center gap-2.5">
                    <Icon name="shield" className="text-gold size-4 shrink-0" />
                    {t("landing.hero.trust.secure")}
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Icon name="calendar" className="text-gold size-4 shrink-0" />
                    {t("venues.detail.cancelPolicy")}
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

function ReviewRow({ review }: { review: ProviderReviewItem }) {
  const { t } = useTranslation()
  const author = review.author ?? t("professionals.reviewsAnonymous")

  return (
    <li className="flex gap-3 px-5 py-4">
      <span className="border-cream/15 bg-cream/5 text-cream/70 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-semibold">
        {review.avatarUrl ? (
          <Image
            src={review.avatarUrl}
            alt={author}
            width={40}
            height={40}
            unoptimized={!isOptimizableImage(review.avatarUrl)}
            className="size-10 object-cover"
          />
        ) : (
          initials(author)
        )}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-cream text-sm font-semibold">{author}</p>
          <Stars rating={review.rating} />
          {review.serviceName && (
            <span className="text-cream/45 text-xs">· {review.serviceName}</span>
          )}
        </div>
        {review.text && (
          <p className="text-cream/70 mt-1.5 text-sm leading-relaxed">{review.text}</p>
        )}
      </div>
    </li>
  )
}
