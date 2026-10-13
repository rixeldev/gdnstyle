"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { getCategoryById } from "@/constants/categories"
import { usePublicVenues } from "@/hooks/use-venues"
import { cn } from "@/utils/cn"
import { normalize } from "@/utils/normalize"
import { venueLocationLabel } from "@/utils/venue"

const MAX_SUGGESTIONS = 6

/**
 * Hero search with live venue suggestions: while the visitor types, matching
 * places (name, category, service or city) appear in a dropdown over the test
 * records. Selecting one opens its venue page; submitting runs a full search.
 */
export function HeroSearch() {
  const { t } = useTranslation()
  const router = useRouter()
  const venues = usePublicVenues()
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const suggestions = useMemo(() => {
    const needle = normalize(query)
    if (!needle) return []

    return venues
      .filter((venue) => {
        const haystack = normalize(
          [
            venue.name,
            venue.city,
            venue.area,
            venue.address,
            venue.categoryId ? t(`categories.${venue.categoryId}`) : "",
            ...(venue.categoryNames ?? []),
            ...venue.services.map((service) => t(`venues.services.${service}`)),
            ...(venue.serviceList ?? []).map((service) => service.name),
          ]
            .filter(Boolean)
            .join(" "),
        )
        return haystack.includes(needle)
      })
      .sort(
        (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || b.rating - a.rating,
      )
      .slice(0, MAX_SUGGESTIONS)
  }, [query, venues, t])

  const visible = open && query.trim().length > 0 && suggestions.length > 0

  /** Close the dropdown when interacting outside the search box. */
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
        setActive(-1)
      }
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  function handleInputChange(value: string) {
    setQuery(value)
    setOpen(true)
    setActive(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!visible) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => (index + 1) % suggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => (index - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === "Escape") {
      setOpen(false)
      setActive(-1)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const highlighted = active >= 0 ? suggestions[active] : null
    if (highlighted) {
      router.push(`/locales/${highlighted.id}`)
      return
    }
    const trimmed = query.trim()
    router.push(trimmed ? `/locales?q=${encodeURIComponent(trimmed)}` : "/locales")
  }

  function goToVenue(venueId: string) {
    router.push(`/locales/${venueId}`)
  }

  return (
    <div ref={rootRef} className="relative mt-8 w-full max-w-xl">
      {/*
        The entrance animation lives on the form, not on this wrapper: the
        animation's retained transform would create a stacking context here and
        trap the suggestion dropdown's z-index below its later siblings.
      */}
      <form
        role="search"
        onSubmit={handleSubmit}
        className="border-cream/15 bg-cream/5 focus-within:border-gold animate-fade-in-up animate-delay-400 animate-fill-mode-both flex w-full items-center gap-2 rounded-full border p-1.5 pl-5 backdrop-blur-md transition focus-within:shadow-[0_0_28px_-10px_rgba(224,176,68,0.55)]"
      >
        <Icon name="search" className="text-cream/40 size-4 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t("landing.hero.search.placeholder")}
          aria-label={t("landing.hero.search.label")}
          role="combobox"
          aria-expanded={visible}
          aria-controls="hero-search-suggestions"
          aria-autocomplete="list"
          autoComplete="off"
          className="text-cream placeholder:text-cream/40 h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <Button type="submit" size="sm" className="shrink-0">
          {t("landing.hero.search.submit")}
        </Button>
      </form>

      {visible && (
        <ul
          id="hero-search-suggestions"
          role="listbox"
          aria-label={t("landing.hero.search.suggestions")}
          className="border-cream/10 bg-ink-card/95 shadow-luxe animate-fade-in-up animate-duration-fast absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border backdrop-blur-md"
        >
          {suggestions.map((venue, index) => {
            const category = getCategoryById(venue.categoryId)
            const categoryLabel = category ? t(category.labelKey) : (venue.categoryNames?.[0] ?? "")
            return (
              <li key={venue.id} role="option" aria-selected={active === index}>
                <button
                  type="button"
                  onClick={() => goToVenue(venue.id)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                    active === index ? "bg-gold/10" : "hover:bg-cream/5",
                  )}
                >
                  <span className="border-gold/25 bg-ink/70 text-gold flex size-9 shrink-0 items-center justify-center rounded-full border">
                    <Icon name={category?.icon ?? "sparkles"} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-cream block truncate text-sm font-medium">
                      {venue.name}
                    </span>
                    <span className="text-cream/50 block truncate text-xs">
                      {categoryLabel} · {venueLocationLabel(venue)}
                    </span>
                  </span>
                  <Icon name="arrow-right" className="text-gold/60 size-4 shrink-0" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
