"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"

import { Icon } from "@/components/ui/icon"
import { Reveal } from "@/components/ui/reveal"
import { CATEGORIES } from "@/constants/categories"
import { CUSTOMER_FEATURES } from "@/constants/site"

export function ClientsSection() {
  const { t } = useTranslation()

  return (
    <section
      id="clientes"
      aria-labelledby="clientes-title"
      className="scroll-mt-24 px-5 py-24 md:px-8"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
            {t("landing.clients.eyebrow")}
          </p>
          <h2
            id="clientes-title"
            className="font-display mt-4 text-4xl leading-tight font-semibold md:text-5xl"
          >
            {t("landing.clients.title")}
          </h2>
          <p className="text-cream/60 mt-5 max-w-md leading-relaxed">
            {t("landing.clients.supporting")}
          </p>

          <div className="mt-8 space-y-5">
            {CUSTOMER_FEATURES.map((feature) => (
              <div key={feature.titleKey} className="border-cream/10 flex gap-4 border-t pt-5">
                <Icon name={feature.icon} className="text-gold mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="text-cream text-sm font-semibold">{t(feature.titleKey)}</p>
                  <p className="text-cream/55 mt-1 text-sm">{t(feature.descriptionKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120} className="grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((category) => (
            <Link
              key={category.id}
              href="/auth/login?role=customer"
              className="group border-cream/10 bg-cream/3 hover:border-gold/50 hover:bg-cream/5 rounded-3xl border px-5 py-6 transition duration-300 hover:-translate-y-1"
            >
              <Icon name={category.icon} className="text-gold size-6" />
              <p className="font-display mt-4 text-xl">{t(category.labelKey)}</p>
              <span className="text-cream/40 group-hover:text-gold mt-2 inline-flex items-center gap-1 text-xs tracking-[0.18em] uppercase transition">
                {t("landing.clients.bookAction")}
                <Icon
                  name="arrow-right"
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
