"use client"

import { useTranslation } from "react-i18next"

import { Icon } from "@/components/ui/icon"
import { Reveal } from "@/components/ui/reveal"
import { PROFESSIONAL_FEATURES } from "@/constants/site"

export function ProfessionalsSection() {
  const { t } = useTranslation()

  return (
    <section
      id="profesionales"
      aria-labelledby="profesionales-title"
      className="border-cream/10 bg-ink-soft relative scroll-mt-24 border-y px-5 py-24 md:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(55,10,91,0.35),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
            {t("landing.professionals.eyebrow")}
          </p>
          <h2
            id="profesionales-title"
            className="font-display mt-4 max-w-2xl text-4xl leading-tight font-semibold md:text-5xl"
          >
            {t("landing.professionals.title")}
          </h2>
          <p className="text-cream/60 mt-5 max-w-xl leading-relaxed">
            {t("landing.professionals.supporting")}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROFESSIONAL_FEATURES.map((feature, index) => (
            <Reveal key={feature.titleKey} delay={index * 70}>
              <article className="border-cream/10 hover:border-gold/40 h-full rounded-3xl border bg-black/40 p-6 transition duration-300 hover:-translate-y-1 hover:bg-black/60">
                <div className="flex items-center justify-between">
                  <p className="font-display text-gold text-xs">{feature.index}</p>
                  <Icon name={feature.icon} className="text-cream/40 size-5" />
                </div>
                <h3 className="mt-3 text-lg font-medium">{t(feature.titleKey)}</h3>
                <p className="text-cream/55 mt-2 text-sm leading-relaxed">
                  {t(feature.descriptionKey)}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
