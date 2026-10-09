"use client"

import Image from "next/image"
import { useTranslation } from "react-i18next"

import { Reveal } from "@/components/ui/reveal"
import { TERMINALS } from "@/constants/site"

/** In-person payment terminals (transparent product renders in /public/terminals). */
export function TerminalsSection() {
  const { t } = useTranslation()

  return (
    <section
      id="pagos"
      aria-labelledby="pagos-title"
      className="border-cream/10 bg-ink-soft relative scroll-mt-24 border-y px-5 py-24 md:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(55,10,91,0.35),transparent_55%)]"
      />

      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
            {t("landing.terminals.eyebrow")}
          </p>
          <h2
            id="pagos-title"
            className="font-display mt-4 max-w-2xl text-4xl leading-tight font-semibold md:text-5xl"
          >
            {t("landing.terminals.title")}
          </h2>
          <p className="text-cream/60 mt-5 max-w-xl leading-relaxed">
            {t("landing.terminals.supporting")}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TERMINALS.map((terminal, index) => (
            <Reveal key={terminal.id} delay={index * 90}>
              <article className="border-cream/10 bg-ink-card flex h-full flex-col overflow-hidden rounded-3xl border">
                <div className="relative flex h-56 items-center justify-center px-8 pt-6">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(224,176,68,0.16),transparent_65%)]"
                  />
                  <Image
                    src={terminal.src}
                    alt={t(`landing.terminals.items.${terminal.id}.alt`)}
                    width={terminal.width}
                    height={terminal.height}
                    sizes="(max-width: 768px) 80vw, 30vw"
                    className="relative h-full w-auto object-contain drop-shadow-[0_20px_45px_rgba(0,0,0,0.55)]"
                  />
                </div>

                <div className="border-cream/10 mt-auto border-t p-6">
                  <h3 className="font-display text-xl">
                    {t(`landing.terminals.items.${terminal.id}.name`)}
                  </h3>
                  <p className="text-cream/55 mt-2 text-sm leading-relaxed">
                    {t(`landing.terminals.items.${terminal.id}.description`)}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
