"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { HERO_SCREENS } from "@/constants/site"
import { cn } from "@/utils/cn"

const AUTOPLAY_MS = 5200

export function PhoneCarousel() {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced || paused) return

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HERO_SCREENS.length)
    }, AUTOPLAY_MS)

    return () => window.clearInterval(timer)
  }, [paused])

  return (
    <div
      role="group"
      aria-label={t("landing.hero.screens.label")}
      className="bob relative mx-auto w-[min(320px,82vw)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(224,176,68,0.22),transparent_68%)] blur-2xl" />

      <div className="border-cream/15 bg-ink-card shadow-luxe rounded-[2.6rem] border p-2">
        <div className="relative aspect-390/844 overflow-hidden rounded-[2.1rem] bg-black">
          {HERO_SCREENS.map((screen, i) => (
            <Image
              key={screen.src}
              src={screen.src}
              alt={t(screen.altKey)}
              fill
              sizes="(max-width: 768px) 82vw, 320px"
              priority={i === 0}
              loading="eager"
              className={cn(
                "object-contain object-top transition-opacity duration-700 motion-reduce:transition-none",
                i === index ? "opacity-100" : "opacity-0",
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 flex justify-center gap-2">
        {HERO_SCREENS.map((screen, i) => (
          <button
            key={screen.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={t("landing.hero.screens.goTo", { name: t(screen.nameKey) })}
            aria-current={i === index}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "bg-gold w-6" : "bg-cream/25 hover:bg-cream/50 w-1.5",
            )}
          />
        ))}
      </div>
    </div>
  )
}
