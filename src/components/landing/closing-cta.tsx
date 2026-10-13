"use client"

import { useTranslation } from "react-i18next"

import { ButtonLink, buttonClasses } from "@/components/ui/button"
import { Reveal } from "@/components/ui/reveal"
import { SectionLink } from "@/components/ui/section-link"

export function ClosingCta() {
  const { t } = useTranslation()

  return (
    <section className="px-5 pb-24 md:px-8">
      <Reveal>
        <div className="border-gold/30 relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 overflow-hidden rounded-4xl border bg-[radial-gradient(circle_at_top_left,rgba(224,176,68,0.18),transparent_42%)] px-7 py-12 md:flex-row md:items-center md:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(55,10,91,0.55),transparent_58%)]"
          />
          <div className="relative">
            <p className="font-display text-3xl font-semibold md:text-4xl">
              {t("landing.closing.title")}
            </p>
            <p className="text-cream/65 mt-3 max-w-md">{t("landing.closing.supporting")}</p>
          </div>
          <div className="relative flex flex-wrap gap-3">
            <ButtonLink href="/auth/login?role=customer">
              {t("landing.closing.primaryCta")}
            </ButtonLink>
            <SectionLink href="/#contact" className={buttonClasses({ variant: "outline" })}>
              {t("landing.closing.secondaryCta")}
            </SectionLink>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
