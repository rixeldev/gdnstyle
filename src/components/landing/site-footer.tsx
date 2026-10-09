"use client"

import { useTranslation } from "react-i18next"

import { ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { LanguageSwitcher } from "@/components/ui/language-switcher"
import { Logo } from "@/components/ui/logo"
import { SectionLink } from "@/components/ui/section-link"
import { FOOTER_NAV, SITE } from "@/constants/site"

export function SiteFooter() {
  const { t } = useTranslation()

  const contactItems = [
    { icon: "mail", value: SITE.email, href: `mailto:${SITE.email}`, external: false },
    {
      icon: "phone",
      value: SITE.phone,
      href: `tel:${SITE.phone.replace(/[^+\d]/g, "")}`,
      external: false,
    },
    {
      icon: "map-pin",
      value: t("landing.contact.address"),
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        t("landing.contact.address"),
      )}`,
      external: true,
    },
  ] as const

  return (
    <footer className="relative overflow-hidden">
      {/* Gold hairline instead of a flat border. */}
      <div
        aria-hidden="true"
        className="via-gold/60 h-px bg-gradient-to-r from-transparent to-transparent"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="bg-royal/40 absolute -bottom-32 -left-24 h-80 w-80 rounded-full blur-3xl" />
        <div className="bg-gold/10 absolute top-10 -right-24 h-72 w-72 rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-10 md:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
          <div>
            <Logo size="sm" />
            <p className="text-cream/50 mt-5 max-w-xs text-sm leading-relaxed">
              {t("landing.footer.tagline")}
            </p>
          </div>

          {FOOTER_NAV.map((group) => (
            <nav key={group.titleKey} aria-label={t(group.titleKey)}>
              <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
                {t(group.titleKey)}
              </p>
              <ul className="mt-5 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <SectionLink
                      href={link.href}
                      className="text-cream/55 hover:text-cream text-sm transition"
                    >
                      {t(link.key)}
                    </SectionLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
              {t("landing.footer.contactTitle")}
            </p>
            <ul className="mt-5 space-y-3 text-sm">
              {contactItems.map((item) => (
                <li key={item.value}>
                  <a
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                    className="text-cream/55 hover:text-cream inline-flex items-start gap-2.5 transition"
                  >
                    <Icon name={item.icon} className="text-gold mt-0.5 h-4 w-4 shrink-0" />
                    <span className="break-words">{item.value}</span>
                  </a>
                </li>
              ))}
            </ul>
            <ButtonLink href="/auth/login?role=customer" size="sm" className="mt-6">
              {t("nav.book")}
            </ButtonLink>
          </div>
        </div>

        {/* Oversized brand wordmark fading into the background. */}
        <p
          aria-hidden="true"
          className="font-display from-cream/10 pointer-events-none mt-16 bg-gradient-to-b to-transparent bg-clip-text text-center text-[clamp(2.8rem,11vw,8.5rem)] leading-none font-semibold tracking-[0.08em] text-transparent uppercase select-none"
        >
          {SITE.name}
        </p>

        <div className="border-cream/10 text-cream/35 mt-10 flex flex-col gap-4 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {SITE.name}. {t("landing.footer.rights")}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <a href={`mailto:${SITE.email}`} className="hover:text-cream transition">
              {SITE.email}
            </a>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  )
}
