"use client"

import { useRef, type PointerEvent } from "react"
import { useTranslation } from "react-i18next"

import { ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { TRUST_ITEMS } from "@/constants/site"

import { PhoneCarousel } from "./phone-carousel"

export function Hero() {
  const { t } = useTranslation()
  const spotRef = useRef<HTMLDivElement>(null)
  const reducedMotionRef = useRef<boolean | null>(null)

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse") return
    if (reducedMotionRef.current === null) {
      reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    }
    if (reducedMotionRef.current) return

    const spot = spotRef.current
    if (!spot) return

    const rect = event.currentTarget.getBoundingClientRect()
    spot.style.setProperty("--spot-x", `${event.clientX - rect.left}px`)
    spot.style.setProperty("--spot-y", `${event.clientY - rect.top}px`)
    spot.style.opacity = "1"
  }

  function handlePointerLeave() {
    if (spotRef.current) spotRef.current.style.opacity = "0"
  }

  return (
    <section
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative overflow-hidden px-5 pt-28 pb-16 md:px-8 md:pt-36 md:pb-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(224,176,68,0.16),transparent_46%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(55,10,91,0.5),transparent_52%)]"
      />
      <div
        ref={spotRef}
        aria-hidden="true"
        className="spotlight pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden="true"
        className="bg-royal/60 motion-safe:animate-drift pointer-events-none absolute top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="animate-fade-in-down animate-fill-mode-both font-display text-gold text-xs font-medium tracking-[0.28em] uppercase">
            {t("landing.hero.eyebrow")}
          </p>

          <h1 className="font-display mt-5 max-w-xl text-[2.6rem] leading-[0.98] font-semibold tracking-tight sm:text-[3.1rem] md:text-7xl">
            <span className="animate-fade-in-up animate-delay-100 animate-fill-mode-both block">
              {t("landing.hero.titleLine1")}
            </span>
            <span className="animate-fade-in-up animate-delay-200 animate-fill-mode-both font-accent text-cream block text-[1.08em] font-semibold italic">
              {t("landing.hero.titleLine2")}
            </span>
            <span className="animate-fade-in-up animate-delay-300 animate-fill-mode-both text-gold-shimmer block">
              {t("landing.hero.titleLine3")}
            </span>
          </h1>

          <p className="text-cream/65 animate-fade-in-up animate-delay-400 animate-fill-mode-both mt-6 max-w-md text-base leading-relaxed md:text-lg">
            {t("landing.hero.supporting")}
          </p>

          <div className="animate-fade-in-up animate-delay-500 animate-fill-mode-both mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/auth/login?role=customer" size="lg">
              {t("landing.hero.primaryCta")}
            </ButtonLink>
            <ButtonLink href="/auth/login?role=professional" variant="outline" size="lg">
              {t("landing.hero.secondaryCta")}
            </ButtonLink>
          </div>

          <div className="animate-fade-in-up animate-delay-500 animate-fill-mode-both text-cream/55 mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
            <span className="border-cream/10 bg-cream/5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
              <span
                role="img"
                aria-label={t("landing.hero.trust.starsLabel")}
                className="flex items-center gap-0.5"
              >
                {[0, 1, 2, 3, 4].map((index) => (
                  <Icon key={index} name="star" className="fill-gold text-gold h-3 w-3" />
                ))}
              </span>
              <span className="text-cream font-semibold">{t("landing.hero.trust.rating")}</span>
              <span className="text-cream/45">{t("landing.hero.trust.reviewsCount")}</span>
            </span>

            {TRUST_ITEMS.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5">
                <Icon name={item.icon} className="text-gold h-3.5 w-3.5" />
                {t(item.key)}
              </span>
            ))}
          </div>
        </div>

        <div className="animate-fade-in-up animate-delay-400 animate-fill-mode-both">
          <PhoneCarousel />
        </div>
      </div>
    </section>
  )
}
