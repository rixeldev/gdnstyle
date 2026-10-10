"use client"

import Image from "next/image"
import { useTranslation } from "react-i18next"

import { ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Reveal } from "@/components/ui/reveal"
import { APP_SCREENS, STORE_LINKS } from "@/constants/site"
import { cn } from "@/utils/cn"

const BULLETS = [
  { id: "payments", icon: "credit-card" },
  { id: "reviews", icon: "star" },
  { id: "support", icon: "phone" },
] as const

/** Fanned-out phone frames: sides tilt and sink, center stays sharp on top. */
const PHONE_FRAMES = [
  "relative z-0 w-[30%] translate-y-8 -rotate-6 sm:translate-y-10",
  "relative z-10 w-[36%]",
  "relative z-0 w-[30%] translate-y-8 rotate-6 sm:translate-y-10",
] as const

/** "The app" section: real screenshots shown in a fan of tilted phones. */
export function AppShowcase() {
  const { t } = useTranslation()

  return (
    <section
      id="app"
      aria-labelledby="app-title"
      className="relative scroll-mt-24 overflow-hidden px-5 py-24 md:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(55,10,91,0.4),transparent_60%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
        <Reveal>
          <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
            {t("landing.app.eyebrow")}
          </p>
          <h2
            id="app-title"
            className="font-display mt-4 max-w-xl text-4xl leading-tight font-semibold md:text-5xl"
          >
            {t("landing.app.title")}
          </h2>
          <p className="text-cream/60 mt-5 max-w-md leading-relaxed">
            {t("landing.app.supporting")}
          </p>

          <div className="mt-8 space-y-5">
            {BULLETS.map((bullet) => (
              <div key={bullet.id} className="border-cream/10 flex gap-4 border-t pt-5">
                <Icon name={bullet.icon} className="text-gold mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="text-cream text-sm font-semibold">
                    {t(`landing.app.bullets.${bullet.id}.title`)}
                  </p>
                  <p className="text-cream/55 mt-1 text-sm">
                    {t(`landing.app.bullets.${bullet.id}.description`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <ButtonLink href="/auth/signup?role=customer" size="lg" className="mt-8">
            {t("landing.app.cta")}
          </ButtonLink>

          <div className="mt-6">
            <p className="text-cream/45 text-xs tracking-[0.18em] uppercase">
              {t("landing.app.download")}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {STORE_LINKS.map((store) => (
                <a
                  key={store.id}
                  href={store.href}
                  target="_blank"
                  rel="noreferrer"
                  className="border-cream/15 bg-cream/5 text-cream hover:border-gold/50 hover:text-gold inline-flex h-11 items-center gap-2.5 rounded-full border px-5 text-sm font-semibold transition"
                >
                  <Icon name={store.icon} className="size-4" />
                  {store.label}
                </a>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="relative mx-auto flex max-w-lg items-end justify-center lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute -inset-10 rounded-full bg-[radial-gradient(circle_at_50%_60%,rgba(55,10,91,0.6),rgba(224,176,68,0.14)_58%,transparent_74%)] blur-2xl"
            />

            {APP_SCREENS.map((screen, index) => (
              <div
                key={screen.src}
                className={cn(
                  "border-cream/15 bg-ink-card shadow-luxe rounded-[2.2rem] border p-1.5",
                  PHONE_FRAMES[index],
                )}
              >
                <div className="overflow-hidden rounded-[1.7rem] bg-black">
                  <Image
                    src={screen.src}
                    alt={t(screen.altKey)}
                    width={739}
                    height={1600}
                    sizes="(max-width: 1024px) 32vw, 260px"
                    className="h-auto w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
