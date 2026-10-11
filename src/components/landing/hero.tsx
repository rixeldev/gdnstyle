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
      <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0" />
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
      <div
        aria-hidden="true"
        className="bg-gold/15 motion-safe:animate-drift animate-delay-500 pointer-events-none absolute -right-16 bottom-8 h-64 w-64 rounded-full blur-3xl"
      />

      <div className="flex h-auto w-full flex-col items-center justify-center gap-6">
        <div className="flex h-auto w-full flex-row items-center justify-center">
          <input
            className="border-cream/10 bg-cream/5 focus:ring-gold placeholder:cream/45 text-cream focus:ring-offset-ink-card/85 rounded-l-full border px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-1 focus:outline-none"
            type="text"
            name=""
            id=""
            placeholder="Example"
          />

          <button className="border-cream/10 bg-cream/5 focus:ring-gold text-cream focus:ring-offset-ink-card/85 rounded-r-full border px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-1 focus:outline-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              className="text-gold size-fit"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
              <path d="M21 21l-6 -6" />
            </svg>
          </button>
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="animate-fade-in-down animate-fill-mode-both border-gold/25 bg-gold/10 text-gold font-display inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.22em] uppercase">
              <span
                aria-hidden="true"
                className="bg-gold h-1.5 w-1.5 rounded-full motion-safe:animate-pulse"
              />
              {t("landing.hero.eyebrow")}
            </p>

            <h1 className="font-display mt-6 max-w-xl text-[2.6rem] leading-[0.98] font-semibold tracking-tight sm:text-[3.1rem] md:text-7xl">
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
              <ButtonLink href="/auth/login?role=customer" size="lg" className="shadow-gold">
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
                    <Icon key={index} name="star" className="fill-gold text-gold size-3" />
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
            <div className="relative mx-auto w-[min(340px,88vw)]">
              {/* Orbit rings around the phone carousel (desktop). */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex"
              >
                <div className="orbit-ring border-gold/20 aspect-square w-110 rounded-full border border-dashed" />
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex"
              >
                <div className="border-cream/10 aspect-square w-140 rounded-full border" />
              </div>

              {/* Floating product chips. */}
              <span className="bob-delayed border-cream/10 bg-ink-card/85 text-cream/85 absolute top-10 -left-10 z-10 hidden items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-medium whitespace-nowrap backdrop-blur-md sm:inline-flex">
                <Icon name="badge-check" className="text-gold size-4" />
                {t("landing.hero.chips.confirmed")}
              </span>
              <span className="bob-delayed border-cream/10 bg-ink-card/85 text-cream/85 absolute -right-6 bottom-24 z-10 hidden items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-medium whitespace-nowrap backdrop-blur-md sm:inline-flex">
                <Icon name="clock" className="text-gold size-4" />
                {t("landing.hero.chips.instant")}
              </span>

              <PhoneCarousel />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
