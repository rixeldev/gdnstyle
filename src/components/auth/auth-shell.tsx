"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"

import { Icon } from "@/components/ui/icon"
import { LanguageSwitcher } from "@/components/ui/language-switcher"
import { Logo } from "@/components/ui/logo"
import { CATEGORIES } from "@/constants/categories"

/** Shared visual frame for every authentication screen. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="grain bg-ink text-cream relative min-h-dvh overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(224,176,68,0.14),transparent_46%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(55,10,91,0.5),transparent_52%)]"
      />
      <div
        aria-hidden="true"
        className="bg-royal/60 motion-safe:animate-drift pointer-events-none absolute top-40 -right-20 h-72 w-72 rounded-full blur-3xl"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="rounded-lg">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
        </div>
      </header>

      <main
        id="main"
        className="relative mx-auto grid max-w-6xl gap-10 px-5 pt-4 pb-16 md:px-8 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-center lg:gap-16 lg:py-14"
      >
        <div className="hidden lg:block">
          <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
            {t("auth.shell.eyebrow")}
          </p>
          <p className="font-display mt-5 text-4xl leading-tight font-semibold">GDN Style</p>
          <p className="text-cream/60 mt-4 max-w-sm leading-relaxed">
            {t("auth.shell.supporting")}
          </p>

          <ul className="mt-8 flex flex-wrap gap-2.5">
            {CATEGORIES.map((category) => (
              <li
                key={category.id}
                className="border-cream/10 bg-cream/3 text-cream/60 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs"
              >
                <Icon name={category.icon} className="text-gold h-3.5 w-3.5" />
                {t(category.labelKey)}
              </li>
            ))}
          </ul>

          <p className="text-cream/40 mt-8 inline-flex items-center gap-2 text-xs">
            <Icon name="badge-check" className="text-gold size-4" />
            {t("auth.shell.trust")}
          </p>
        </div>

        <div className="w-full">
          <div className="border-cream/10 bg-ink-card/85 shadow-luxe rounded-4xl border p-6 backdrop-blur-sm sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
