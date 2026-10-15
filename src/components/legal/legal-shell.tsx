"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"

import { LanguageSwitcher } from "@/components/ui/language-switcher"
import { Logo } from "@/components/ui/logo"
import { useSession } from "@/libs/session"

interface LegalShellProps {
  title: string
  subtitle: string
  children: React.ReactNode
}

/** Shared frame for marketing/legal pages (contact, FAQ, policies, terms). */
export function LegalShell({ title, subtitle, children }: LegalShellProps) {
  const { t } = useTranslation()
  const { authenticated } = useSession()

  return (
    <div className="grain bg-ink text-cream relative min-h-dvh overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(224,176,68,0.12),transparent_46%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(55,10,91,0.45),transparent_52%)]"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="rounded-lg">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={authenticated ? "/dashboard" : "/auth/login?role=customer"}
            className="text-cream/70 hover:text-gold hidden text-sm font-semibold transition sm:block"
          >
            {authenticated ? t("nav.dashboard") : t("nav.book")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main id="main" className="relative mx-auto max-w-3xl px-5 pt-6 pb-20 md:px-8">
        <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">GDN Style</p>
        <h1 className="font-display mt-4 text-4xl leading-tight font-semibold md:text-5xl">
          {title}
        </h1>
        <p className="text-cream/60 mt-4 leading-relaxed">{subtitle}</p>
        <div className="mt-10">{children}</div>
      </main>

      <footer className="border-cream/10 relative border-t px-5 py-6 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between text-sm">
          <Link href="/" className="text-cream/50 hover:text-cream transition">
            {t("common.backHome")}
          </Link>
          <p className="text-cream/35 text-xs">© GDN Style</p>
        </div>
      </footer>
    </div>
  )
}
