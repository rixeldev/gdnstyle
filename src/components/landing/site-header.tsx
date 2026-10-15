"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { LanguageSwitcher } from "@/components/ui/language-switcher"
import { Logo } from "@/components/ui/logo"
import { SectionLink } from "@/components/ui/section-link"
import { NAV_LINKS } from "@/constants/site"
import { useFavorites } from "@/hooks/use-favorites"
import { useScrolled } from "@/hooks/use-scrolled"
import { useShopCart } from "@/hooks/use-shop-cart"
import { useSession } from "@/libs/session"
import { signOut } from "@/services/auth.service"
import { cn } from "@/utils/cn"

interface SiteHeaderProps {
  /** Overrides the header CTA (the venue directory uses "Sign in"). */
  ctaKey?: string
  ctaHref?: string
}

export function SiteHeader({ ctaKey = "nav.book", ctaHref = "/venues" }: SiteHeaderProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const scrolled = useScrolled()
  const { authenticated, user } = useSession()
  const professional = user?.role === "professional"
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { count: favoritesCount } = useFavorites()
  const { count: cartCount } = useShopCart()

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    setOpen(false)
    router.replace("/")
    router.refresh()
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open
          ? "border-cream/10 bg-ink/85 border-b backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 md:h-18 md:px-8">
        <Link href="/" className="rounded-lg" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav aria-label={t("nav.main")} className="hidden items-center gap-6 md:flex lg:gap-8">
          {NAV_LINKS.map((link) => (
            <SectionLink
              key={link.href}
              href={link.href}
              className="text-cream/70 hover:text-cream text-sm transition"
            >
              {t(link.key)}
            </SectionLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex lg:gap-4">
          <Link
            href="/shop"
            aria-label={t("nav.shop")}
            className="text-cream/70 hover:text-gold relative inline-flex items-center transition"
          >
            <Icon name="store" className="size-5" />
            {cartCount > 0 && (
              <span className="bg-gold text-gold-ink absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
                {cartCount}
              </span>
            )}
          </Link>
          {authenticated && !professional && (
            <Link
              href="/favorites"
              aria-label={t("favorites.title")}
              className="text-cream/70 hover:text-gold relative inline-flex items-center transition"
            >
              <Icon
                name="heart"
                className={cn("size-5", favoritesCount > 0 && "fill-gold text-gold")}
              />
              {favoritesCount > 0 && (
                <span className="bg-gold text-gold-ink absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
                  {favoritesCount}
                </span>
              )}
            </Link>
          )}
          {authenticated ? (
            <ButtonLink href="/dashboard" variant="outline" size="sm">
              {t("nav.dashboard")}
            </ButtonLink>
          ) : (
            <ButtonLink href="/auth/login?role=customer" variant="ghost" size="sm">
              {t("nav.signIn")}
            </ButtonLink>
          )}
          <LanguageSwitcher />
          {/* The account button above already covers auth: it reads "Sign in"
              for a visitor and "My panel" when signed in. Rendering a second
              auth CTA here repeated it verbatim on every VenueShell route
              (which passes `nav.signIn` -> `/auth/login`), so the page CTA only
              appears when it offers something else, or for a professional. */}
          {(professional || !ctaHref.startsWith("/auth")) && (
            <ButtonLink href={professional ? "/venues" : ctaHref} size="sm">
              {professional ? t("nav.explore") : t(ctaKey)}
            </ButtonLink>
          )}
        </div>

        <button
          type="button"
          className="text-cream flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "close" : "menu"} className="size-6" />
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="animate-fade-in-down animate-duration-fast border-cream/10 bg-ink/95 border-t backdrop-blur-md md:hidden"
        >
          <nav
            aria-label={t("nav.main")}
            className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-5"
          >
            {NAV_LINKS.map((link) => (
              <SectionLink
                key={link.href}
                href={link.href}
                onNavigate={() => setOpen(false)}
                className="text-cream/80 hover:bg-cream/5 hover:text-cream rounded-lg px-2 py-3 text-base transition"
              >
                {t(link.key)}
              </SectionLink>
            ))}

            <Link
              href="/shop"
              onClick={() => setOpen(false)}
              className="text-cream/80 hover:bg-cream/5 hover:text-cream inline-flex items-center gap-2 rounded-lg px-2 py-3 text-base transition"
            >
              <Icon name="store" className="size-5" />
              {t("nav.shop")}
              {cartCount > 0 && (
                <span className="bg-gold text-gold-ink inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold">
                  {cartCount}
                </span>
              )}
            </Link>

            {authenticated && !professional && (
              <Link
                href="/favorites"
                onClick={() => setOpen(false)}
                className="text-cream/80 hover:bg-cream/5 hover:text-cream inline-flex items-center gap-2 rounded-lg px-2 py-3 text-base transition"
              >
                <Icon
                  name="heart"
                  className={cn("size-5", favoritesCount > 0 && "fill-gold text-gold")}
                />
                {t("favorites.title")}
                {favoritesCount > 0 && (
                  <span className="bg-gold text-gold-ink inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold">
                    {favoritesCount}
                  </span>
                )}
              </Link>
            )}

            <div className="border-cream/10 mt-3 flex items-center justify-between border-t pt-4">
              <LanguageSwitcher />
            </div>

            <div className="mt-3 flex flex-col gap-2.5">
              {authenticated ? (
                <>
                  <ButtonLink href="/dashboard" onClick={() => setOpen(false)}>
                    {t("nav.dashboard")}
                  </ButtonLink>
                  <Button variant="outline" onClick={handleSignOut} loading={signingOut}>
                    {t("dashboard.signOut")}
                  </Button>
                </>
              ) : (
                <>
                  <ButtonLink href="/auth/login?role=customer" onClick={() => setOpen(false)}>
                    {t("nav.signIn")}
                  </ButtonLink>
                  <ButtonLink
                    href="/auth/signup?role=customer"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    {t("auth.login.signUpLink")}
                  </ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
