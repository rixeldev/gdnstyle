"use client"

import { useTranslation } from "react-i18next"

import { Reveal } from "@/components/ui/reveal"
import { HOW_IT_WORKS } from "@/constants/site"

export function HowItWorks() {
  const { t } = useTranslation()

  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-title"
      className="scroll-mt-24 px-5 py-24 md:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
            {t("landing.howItWorks.eyebrow")}
          </p>
          <h2
            id="como-funciona-title"
            className="font-display mt-4 text-4xl font-semibold md:text-5xl"
          >
            {t("landing.howItWorks.title")}
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, index) => (
            <Reveal key={step.titleKey} delay={index * 90}>
              <article className="group border-cream/10 hover:border-gold/40 relative h-full overflow-hidden rounded-3xl border p-7 transition duration-300">
                <span
                  aria-hidden="true"
                  className="font-display text-gold/60 group-hover:text-gold text-5xl transition-colors"
                >
                  {step.index}
                </span>
                <h3 className="mt-6 text-2xl font-medium">{t(step.titleKey)}</h3>
                <p className="text-cream/55 mt-3 text-sm leading-relaxed">
                  {t(step.descriptionKey)}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
