"use client"

import type { FormEvent } from "react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs"
import { Button, ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { VenueCard } from "@/components/venues/venue-card"
import { VenueMap } from "@/components/venues/venue-map"
import { CATEGORIES, getCategoryById } from "@/constants/categories"
import { VENUES, VENUE_ZONES } from "@/constants/venues"
import { useFavorites } from "@/hooks/use-favorites"
import { useIsClient } from "@/hooks/use-is-client"
import { cn } from "@/utils/cn"
import { dayNumber } from "@/utils/date"
import { toIntlLocale } from "@/utils/format"
import { normalize } from "@/utils/normalize"

type SortKey = "relevance" | "rating" | "priceAsc" | "priceDesc"

const SORT_KEYS: { key: SortKey; labelKey: string }[] = [
  { key: "relevance", labelKey: "directory.sortRelevance" },
  { key: "rating", labelKey: "directory.sortRating" },
  { key: "priceAsc", labelKey: "directory.sortPriceAsc" },
  { key: "priceDesc", labelKey: "directory.sortPriceDesc" },
]

interface VenueDirectoryProps {
  initialQuery?: string
  initialCategory?: string
  initialCity?: string
  /** Keep the URL in sync while filtering (base `/locales` route only). */
  syncUrl?: boolean
}

/**
 * Venue directory (Vagaro/Booksy style). Filters, sorting and the map run on
 * the client over the test records; the base route pre-filters by `?q=` on the
 * server so the first paint already reflects the search.
 */
export function VenueDirectory({
  initialQuery = "",
  initialCategory = "all",
  initialCity,
  syncUrl = false,
}: VenueDirectoryProps) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory)
  const [zone, setZone] = useState("all")
  const [sort, setSort] = useState<SortKey>("relevance")
  const [showMap, setShowMap] = useState(false)
  const { count: favoritesCount } = useFavorites()
  const isClient = useIsClient()
  const locale = toIntlLocale(i18n.language ?? "es")

  const zones = useMemo(
    () => (initialCity ? VENUE_ZONES.filter((item) => item.city === initialCity) : VENUE_ZONES),
    [initialCity],
  )

  const results = useMemo(() => {
    const needle = normalize(query)

    const filtered = VENUES.filter((venue) => {
      if (initialCity && venue.city !== initialCity) return false
      if (category !== "all" && venue.categoryId !== category) return false
      if (zone !== "all" && venue.area !== zone) return false
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
    })

    const sorted = [...filtered]
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating)
    else if (sort === "priceAsc") sorted.sort((a, b) => a.priceFrom - b.priceFrom)
    else if (sort === "priceDesc") sorted.sort((a, b) => b.priceFrom - a.priceFrom)
    else
      sorted.sort(
        (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || b.rating - a.rating,
      )

    return sorted
  }, [query, category, zone, sort, initialCity, t])

  const mapPoints = useMemo(
    () =>
      results.map((venue) => ({
        id: venue.id,
        name: venue.name,
        lat: venue.lat,
        lon: venue.lon,
        href: `/locales/${venue.id}`,
      })),
    [results],
  )

  const presetCategory = initialCategory !== "all" ? getCategoryById(initialCategory) : undefined
  const heading = presetCategory
    ? t("directory.categoryTitle", { category: t(presetCategory.labelKey) })
    : initialCity
      ? t("directory.cityTitle", { city: initialCity })
      : t("directory.title")
  const supporting = presetCategory
    ? t("directory.categorySupporting", { category: t(presetCategory.labelKey) })
    : initialCity
      ? t("directory.citySupporting", { city: initialCity })
      : t("directory.supporting")

  const crumbs: Crumb[] = [{ label: t("breadcrumbs.home"), href: "/" }]
  crumbs.push(
    presetCategory || initialCity
      ? { label: t("breadcrumbs.directory"), href: "/locales" }
      : { label: t("breadcrumbs.directory") },
  )
  if (presetCategory) crumbs.push({ label: t(presetCategory.labelKey) })
  if (initialCity) crumbs.push({ label: initialCity })

  // Deterministic "live" proof of activity (client-only so prerender stays stable).
  const proofCount = 12 + (isClient ? dayNumber(new Date()) % 9 : 0)

  function syncFilters(overrides: { query?: string } = {}) {
    if (!syncUrl) return
    const params = new URLSearchParams()
    const nextQuery = (overrides.query ?? query).trim()
    if (nextQuery) params.set("q", nextQuery)
    const search = params.toString()
    window.history.replaceState(null, "", search ? `/locales?${search}` : "/locales")
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    syncFilters()
  }

  function selectCategory(next: string) {
    setCategory(next)
    setZone("all")
  }

  function clearFilters() {
    setQuery("")
    setCategory("all")
    setZone("all")
    if (syncUrl) window.history.replaceState(null, "", "/locales")
  }

  const chipClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
      active
        ? "border-gold/60 bg-gold/15 text-gold"
        : "border-cream/10 bg-cream/3 text-cream/60 hover:border-gold/40 hover:text-cream",
    )

  return (
    <main id="main">
      <section className="relative overflow-hidden px-5 pt-24 pb-10 md:px-8 md:pt-28">
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
          <Breadcrumbs items={crumbs} className="mb-6" />

          <p className="font-display text-gold text-xs tracking-[0.28em] uppercase">
            {t("directory.eyebrow")}
          </p>
          <h1 className="font-display mt-4 text-4xl leading-tight font-semibold md:text-5xl">
            {heading}
          </h1>
          <p className="text-cream/60 mt-3 max-w-2xl text-base">{supporting}</p>

          <form
            role="search"
            onSubmit={handleSubmit}
            className="mt-6 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="border-cream/15 bg-ink/60 focus-within:border-gold/60 flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border px-4 backdrop-blur-sm transition">
              <Icon name="search" className="text-cream/40 size-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("directory.searchPlaceholder")}
                aria-label={t("directory.searchLabel")}
                className="text-cream placeholder:text-cream/40 h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <Button type="submit" className="shrink-0">
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
              onClick={() => selectCategory("all")}
              aria-pressed={category === "all"}
              className={chipClass(category === "all")}
            >
              {t("directory.all")}
            </button>
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCategory(item.id)}
                aria-pressed={category === item.id}
                className={chipClass(category === item.id)}
              >
                <Icon name={item.icon} className="size-3.5" />
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-cream/40 mr-1 text-[11px] tracking-[0.16em] uppercase">
              {t("directory.filterAreaLabel")}
            </span>
            <button
              type="button"
              onClick={() => setZone("all")}
              aria-pressed={zone === "all"}
              className={chipClass(zone === "all")}
            >
              {t("directory.allAreas")}
            </button>
            {zones.map((item) => (
              <button
                key={`${item.area}-${item.city}`}
                type="button"
                onClick={() => setZone(item.area)}
                aria-pressed={zone === item.area}
                className={chipClass(zone === item.area)}
              >
                {item.area}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="text-cream/60 inline-flex items-center gap-2 text-xs">
              <Icon name="sliders" className="text-cream/40 size-4" />
              <span className="sr-only">{t("directory.sortLabel")}</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label={t("directory.sortLabel")}
                className="border-cream/15 bg-ink-card text-cream focus:border-gold/60 h-9 rounded-full border px-3 text-xs outline-none"
              >
                {SORT_KEYS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMap((value) => !value)}
              aria-pressed={showMap}
              iconLeft={<Icon name="map" className="size-4" />}
            >
              {showMap ? t("directory.mapHide") : t("directory.mapToggle")}
            </Button>

            <ButtonLink
              href="/favoritos"
              variant="subtle"
              size="sm"
              iconLeft={<Icon name="heart" className="size-4" />}
            >
              {t("directory.favoritesLink")}
              {favoritesCount > 0 && (
                <span className="bg-gold text-gold-ink inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold">
                  {favoritesCount}
                </span>
              )}
            </ButtonLink>

            <p className="text-cream/45 ml-auto inline-flex items-center gap-2 text-xs">
              <span aria-hidden="true" className="bg-gold size-1.5 animate-pulse rounded-full" />
              {t("directory.socialProof", { count: proofCount })}
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 pt-8 pb-14 md:px-8">
        <div className="mx-auto max-w-6xl">
          {showMap && (
            <div className="mb-8">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <p className="font-display text-lg font-semibold">{t("directory.mapTitle")}</p>
                <p className="text-cream/45 text-xs">{t("directory.mapHint")}</p>
              </div>
              <VenueMap
                points={mapPoints}
                label={t("directory.mapTitle")}
                className="border-cream/10 h-95 w-full overflow-hidden rounded-4xl border"
              />
            </div>
          )}

          <p className="text-cream/45 text-sm">
            {t("directory.results", { count: results.length })}
          </p>

          {results.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((venue) => (
                <VenueCard key={venue.id} venue={venue} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="border-cream/10 bg-cream/2 mt-6 rounded-4xl border border-dashed px-6 py-12 text-center">
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
            <ButtonLink href="/auth/login">{t("nav.signIn")}</ButtonLink>
            <ButtonLink href="/auth/signup?role=customer" variant="outline">
              {t("directory.createAccount")}
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  )
}
