"use client"

import { useTranslation } from "react-i18next"

import { Icon } from "@/components/ui/icon"
import { Reveal } from "@/components/ui/reveal"
import { TESTIMONIALS, type Testimonial } from "@/constants/testimonials"
import { cn } from "@/utils/cn"

/**
 * How many times the review list is repeated in the marquee track. The track
 * loops over half its width (`-50%`), so the count must stay even and large
 * enough that wide screens never reach the end of the track (6 copies ≈ 11k px
 * at the current card width).
 */
const COPIES = 6

function Stars({ rating }: { rating: number }) {
  const { t } = useTranslation()

  return (
    <div
      role="img"
      aria-label={t("landing.testimonials.starsLabel", { count: rating })}
      className="flex items-center gap-1"
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <Icon
          key={index}
          name="star"
          className={cn("h-3.5 w-3.5", index < rating ? "fill-gold text-gold" : "text-cream/25")}
        />
      ))}
    </div>
  )
}

function ReviewCard({ testimonial }: { testimonial: Testimonial }) {
  const { t } = useTranslation()

  return (
    <article className="border-cream/10 bg-ink-card flex h-full w-[19rem] shrink-0 flex-col rounded-3xl border p-6">
      <Stars rating={testimonial.rating} />
      <blockquote className="font-accent text-cream/75 mt-4 text-lg leading-relaxed italic">
        “{t(`landing.testimonials.items.${testimonial.id}`)}”
      </blockquote>
      <footer className="border-cream/10 mt-auto flex items-center gap-3 border-t pt-4">
        <span
          aria-hidden="true"
          className="from-royal to-gold-soft text-cream grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br text-xs font-semibold"
        >
          {testimonial.initials}
        </span>
        <div>
          <p className="text-sm font-semibold">{testimonial.name}</p>
          <p className="text-cream/45 text-xs">{t(testimonial.categoryKey)}</p>
        </div>
      </footer>
    </article>
  )
}

/** Slow marquee of in-app style reviews (pauses while hovered). */
export function TestimonialsSection() {
  const { t } = useTranslation()

  return (
    <section
      id="opiniones"
      aria-labelledby="opiniones-title"
      className="relative scroll-mt-24 px-5 py-24 md:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
              {t("landing.testimonials.eyebrow")}
            </p>
            <h2
              id="opiniones-title"
              className="font-display mt-4 text-4xl leading-tight font-semibold md:text-5xl"
            >
              {t("landing.testimonials.title")}
            </h2>
            <p className="text-cream/60 mt-5 max-w-xl leading-relaxed">
              {t("landing.testimonials.supporting")}
            </p>
          </Reveal>

          <Reveal delay={120}>
            <span className="border-gold/25 bg-gold/10 text-gold inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold">
              <Icon name="star" className="fill-gold h-4 w-4" />
              {t("landing.testimonials.aggregate")}
            </span>
          </Reveal>
        </div>
      </div>

      <div className="relative mt-12">
        <div
          aria-hidden="true"
          className="from-ink pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r to-transparent"
        />
        <div
          aria-hidden="true"
          className="from-ink pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l to-transparent"
        />

        <div className="overflow-hidden py-2">
          <div className="motion-safe:animate-marquee-reviews flex w-max items-stretch will-change-transform hover:[animation-play-state:paused]">
            {[...Array(COPIES).keys()].map((copy) => (
              <ul
                key={copy}
                aria-hidden={copy > 0 || undefined}
                aria-label={copy === 0 ? t("landing.testimonials.listLabel") : undefined}
                className="flex shrink-0 gap-4 pr-4"
              >
                {TESTIMONIALS.map((testimonial) => (
                  <li key={testimonial.id} className="flex">
                    <ReviewCard testimonial={testimonial} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
