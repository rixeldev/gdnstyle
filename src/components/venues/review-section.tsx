"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { getVenueReviews } from "@/constants/reviews"
import type { Venue } from "@/constants/venues"
import { useStoredList } from "@/hooks/use-stored-list"
import { useBookingAccess, useSession } from "@/libs/session"
import { createId } from "@/libs/storage"
import { cn } from "@/utils/cn"
import { formatNumber } from "@/utils/format"
import { initials } from "@/utils/initials"

interface LocalReview {
  id: string
  author: string
  rating: number
  text: string
}

interface ReviewSectionProps {
  venue: Venue
  locale: string
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

/** Venue reviews: deterministic test entries plus locally added ones. */
export function ReviewSection({ venue, locale }: ReviewSectionProps) {
  const { t } = useTranslation()
  const {
    items: localReviews,
    ready: loaded,
    mutate,
  } = useStoredList<LocalReview>(`gdn.reviews.${venue.id}`)
  const { ready: accessReady, allowed } = useBookingAccess()
  const { user } = useSession()
  const [name, setName] = useState("")
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")

  const seedReviews = venue.reviewsList ? [] : getVenueReviews(venue)
  const serviceLabel = venue.services[0]
    ? t(`venues.services.${venue.services[0]}`)
    : (venue.serviceList?.[0]?.name ?? "")
  const ratingText = formatNumber(venue.rating, locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = comment.trim()
    if (!text) return

    mutate((previous) => [
      {
        id: createId("review"),
        author: name.trim() || user?.fullName || t("venues.detail.reviewsAnonymous"),
        rating,
        text,
      },
      ...previous,
    ])
    setName("")
    setRating(5)
    setComment("")
    toast(t("venues.detail.reviewsSubmitted"))
  }

  return (
    <section
      aria-labelledby="reviews-title"
      className="border-cream/10 bg-cream/2 rounded-4xl border p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reviews-title" className="font-display text-xl font-semibold">
            {t("venues.detail.reviewsTitle")}
          </h2>
          <p className="text-cream/50 mt-1 text-sm">{t("venues.detail.reviewsSupporting")}</p>
        </div>
        <p className="text-cream/70 flex items-center gap-2 text-sm">
          <Stars rating={venue.rating} />
          <span className="text-cream font-semibold">{ratingText}</span>
        </p>
      </div>

      <ul className="mt-6 space-y-4">
        {localReviews.map((review) => (
          <li key={review.id} className="border-cream/10 flex gap-3 border-b pb-4 last:border-0">
            <span className="border-gold/30 bg-gold/10 text-gold flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
              {initials(review.author)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-cream text-sm font-semibold">{review.author}</p>
                <Stars rating={review.rating} />
              </div>
              <p className="text-cream/65 mt-1.5 text-sm leading-relaxed">{review.text}</p>
            </div>
          </li>
        ))}

        {(venue.reviewsList ?? []).map((review) => {
          const author = review.author ?? t("venues.detail.reviewsAnonymous")
          return (
            <li key={review.id} className="border-cream/10 flex gap-3 border-b pb-4 last:border-0">
              <span className="border-cream/15 bg-cream/5 text-cream/70 flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                {initials(author)}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-cream text-sm font-semibold">{author}</p>
                  <Stars rating={review.rating} />
                </div>
                {review.text && (
                  <p className="text-cream/70 mt-1.5 text-sm leading-relaxed">{review.text}</p>
                )}
              </div>
            </li>
          )
        })}

        {seedReviews.map((review) => (
          <li key={review.id} className="border-cream/10 flex gap-3 border-b pb-4 last:border-0">
            <span className="border-cream/15 bg-cream/5 text-cream/70 flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
              {initials(review.author)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-cream text-sm font-semibold">{review.author}</p>
                <Stars rating={review.rating} />
              </div>
              <p className="text-cream/70 mt-1.5 text-sm leading-relaxed">
                {t(review.textKey, { service: serviceLabel })}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {!accessReady ? null : allowed ? (
        <form
          onSubmit={handleSubmit}
          className="border-cream/10 bg-ink/40 mt-6 space-y-4 rounded-3xl border p-5"
        >
          <div>
            <label htmlFor="review-name" className="text-cream/70 mb-1.5 block text-sm">
              {t("venues.detail.reviewsName")}
            </label>
            <input
              id="review-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("auth.signup.fullNamePlaceholder")}
              className="border-cream/15 bg-ink/60 text-cream placeholder:text-cream/35 focus:border-gold/60 h-11 w-full rounded-xl border px-3.5 text-sm transition outline-none"
            />
          </div>

          <fieldset>
            <legend className="text-cream/70 mb-1.5 block text-sm">
              {t("venues.detail.reviewsRating")}
            </legend>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-pressed={rating === value}
                  aria-label={t("landing.testimonials.starsLabel", { count: value })}
                >
                  <Icon
                    name="star"
                    className={cn(
                      "size-6",
                      value <= rating ? "fill-gold text-gold" : "text-cream/25",
                    )}
                  />
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="review-comment" className="text-cream/70 mb-1.5 block text-sm">
              {t("venues.detail.reviewsComment")}
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t("venues.detail.reviewsCommentPlaceholder")}
              rows={3}
              className="border-cream/15 bg-ink/60 text-cream placeholder:text-cream/35 focus:border-gold/60 w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm transition outline-none"
            />
          </div>

          <Button type="submit" size="sm" disabled={!comment.trim()}>
            {t("venues.detail.reviewsSubmit")}
          </Button>
        </form>
      ) : (
        <div className="border-cream/10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-dashed p-5">
          <p className="text-cream/60 text-sm">{t("venues.detail.reviewsLoginHint")}</p>
          <ButtonLink
            href={`/auth/login?next=${encodeURIComponent(`/locales/${venue.id}`)}`}
            variant="outline"
            size="sm"
          >
            {t("nav.signIn")}
          </ButtonLink>
        </div>
      )}
    </section>
  )
}
