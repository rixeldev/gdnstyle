"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { BackToTop } from "@/components/ui/back-to-top"
import { Button, ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { CATEGORIES } from "@/constants/categories"
import { VENUES } from "@/constants/venues"
import { cn } from "@/utils/cn"
import { toIntlLocale } from "@/utils/format"

import { VenueCard } from "./venue-card"

/** Accent-insensitive search normalisation (á → a, ü → u, …). */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

/**
 * Marketplace directory shown on the login route before any form: visitors
 * browse the indexed venues (test records for now) and only then sign in.
 * Filtering runs client-side over `VENUES` until the database is connected.
 */
export function VenueDirectory({ initialQuery = "" }: { initialQuery?: string }) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState<string>("all")

  const results = useMemo(() => {
    const needle = normalize(query)

    return VENUES.filter((venue) => {
      if (category !== "all" && venue.categoryId !== category) return false
      if (!needle) return true

      const haystack = normalize(
        [
          venue.name,
          venue.city,
          venue.area,
          t(`categories.${venue.categoryId}`),
          ...venue.services.map((service) => t(`venues.services.${service}`)),
        ].join(" "),
      )

      return haystack.includes(needle)
    }).sort(
      (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || b.rating - a.rating,
    )
  }, [query, category, t])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    const url = trimmed ? `/auth/login?q=${encodeURIComponent(trimmed)}` : "/auth/login"
    window.history.replaceState(null, "", url)
  }

  function clearFilters() {
    setQuery("")
    setCategory("all")
    window.history.replaceState(null, "", "/auth/login")
  }

  const locale = toIntlLocale(i18n.language ?? "es")

  return (
    <div className="grain bg-ink text-cream relative min-h-dvh overflow-x-hidden">
      <SiteHeader ctaKey="nav.signIn" ctaHref="/auth/login?auth=1" />

      <main id="main">
        <section className="relative overflow-hidden px-5 pt-28 pb-10 md:px-8 md:pt-32">
          <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(224,176,68,0.14),transparent_45%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(55,10,91,0.45),transparent_55%)]"
          />

          <div className="relative mx-auto max-w-6xl">
            <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
              {t("directory.eyebrow")}
            </p>
            <h1 className="font-display mt-4 max-w-2xl text-4xl leading-tight font-semibold md:text-5xl">
              {t("directory.title")}
            </h1>
            <p className="text-cream/60 mt-5 max-w-xl leading-relaxed">
              {t("directory.supporting")}
            </p>

            <form
              role="search"
              onSubmit={handleSubmit}
              className="border-cream/15 bg-cream/5 focus-within:border-gold/50 mt-8 flex w-full max-w-2xl items-center gap-2 rounded-full border p-1.5 pl-5 backdrop-blur-md transition"
            >
              <Icon name="search" className="text-cream/40 size-4 shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("directory.searchPlaceholder")}
                aria-label={t("directory.searchLabel")}
                className="text-cream placeholder:text-cream/40 h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <Button type="submit" size="sm" className="shrink-0">
                {t("directory.search")}
              </Button>
            </form>

            <div
              role="group"
              aria-label={t("directory.filtersLabel")}
              className="mt-6 flex flex-wrap gap-2"
            >
              <button
                type="button"
                onClick={() => setCategory("all")}
                aria-pressed={category === "all"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                  category === "all"
                    ? "border-gold/60 bg-gold/15 text-gold"
                    : "border-cream/10 bg-cream/5 text-cream/60 hover:border-cream/25 hover:text-cream",
                )}
              >
                {t("directory.all")}
              </button>

              {CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  aria-pressed={category === item.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                    category === item.id
                      ? "border-gold/60 bg-gold/15 text-gold"
                      : "border-cream/10 bg-cream/5 text-cream/60 hover:border-cream/25 hover:text-cream",
                  )}
                >
                  <Icon name={item.icon} className="size-3.5" />
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-5 pb-20 md:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="text-cream/45 text-xs tracking-[0.18em] uppercase">
              {t("directory.results", { count: results.length })}
            </p>

            {results.length > 0 ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((venue) => (
                  <VenueCard key={venue.id} venue={venue} locale={locale} />
                ))}
              </div>
            ) : (
              <div className="border-cream/10 bg-cream/3 mt-6 rounded-3xl border p-10 text-center">
                <Icon name="search" className="text-cream/25 mx-auto size-8" />
                <p className="text-cream/70 mt-4 text-sm">
                  {t("directory.empty", { query: query.trim() })}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={clearFilters}
                >
                  {t("directory.emptyAction")}
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="px-5 pb-24 md:px-8">
          <div className="border-gold/25 relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 overflow-hidden rounded-4xl border bg-[radial-gradient(circle_at_top_left,rgba(224,176,68,0.16),transparent_45%)] px-7 py-10 md:flex-row md:items-center md:px-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(55,10,91,0.5),transparent_60%)]"
            />
            <div className="relative">
              <p className="font-display text-2xl font-semibold md:text-3xl">
                {t("directory.accountTitle")}
              </p>
              <p className="text-cream/60 mt-2 max-w-md text-sm">{t("directory.accountBody")}</p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <ButtonLink href="/auth/login?auth=1">{t("nav.signIn")}</ButtonLink>
              <ButtonLink href="/auth/signup?role=customer" variant="outline">
                {t("directory.createAccount")}
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <BackToTop />
    </div>
  )
}
