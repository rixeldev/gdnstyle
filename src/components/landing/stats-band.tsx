"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Icon } from "@/components/ui/icon"
import { STATS, type Stat } from "@/constants/site"

interface StatValueProps {
  stat: Stat
  animate: boolean
  locale: string
}

function StatValue({ stat, animate, locale }: StatValueProps) {
  const [display, setDisplay] = useState(stat.value)

  useEffect(() => {
    if (!animate) return

    const duration = 1400
    let frame = 0
    let startedAt: number | null = null

    const tick = (now: number) => {
      if (startedAt === null) startedAt = now
      const progress = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(stat.value * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate, stat.value])

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: stat.decimals,
    maximumFractionDigits: stat.decimals,
  }).format(display)

  return (
    <dd className="font-display text-gold flex items-center justify-center gap-1.5 text-4xl font-semibold md:text-5xl">
      <span>
        {formatted}
        {stat.suffix}
      </span>
      {stat.star && <Icon name="star" className="fill-gold size-5 md:h-6 md:w-6" />}
    </dd>
  )
}

/** Numbers band that counts up the first time it scrolls into view. */
export function StatsBand() {
  const { t, i18n } = useTranslation()
  const [animate, setAnimate] = useState(false)
  const bandRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const node = bandRef.current
    if (!node) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setAnimate(true)
          observer.disconnect()
        }
      },
      { threshold: 0.4 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-ES"

  return (
    <section
      ref={bandRef}
      aria-labelledby="stats-title"
      className="border-cream/10 bg-ink-soft relative scroll-mt-24 border-y px-5 py-14 md:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(55,10,91,0.35),transparent_72%)]"
      />

      <div className="relative mx-auto max-w-6xl">
        <h2
          id="stats-title"
          className="font-display text-gold text-center text-xs tracking-[0.28em] uppercase"
        >
          {t("landing.stats.title")}
        </h2>

        <dl className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.id} className="flex flex-col-reverse items-center gap-2 text-center">
              <dt className="text-cream/55 text-sm">{t(`landing.stats.items.${stat.id}`)}</dt>
              <StatValue stat={stat} animate={animate} locale={locale} />
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
