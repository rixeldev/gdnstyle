"use client"

import Image from "next/image"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"

import { useStoredList } from "@/hooks/use-stored-list"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/utils/cn"
import { normalize } from "@/utils/normalize"

const MAX_SUGGESTIONS = 6
const MAX_RECENT_SEARCHES = 5

/** localStorage key for the "recent searches" panel (shared app-wide). */
export const SHOP_RECENT_KEY = "gdn.shop.recent"

/** Row shape the storefront reads from the `products` table. */
export interface ShopProduct {
  id: string
  title: string | null
  description: string | null
  price: number | string | null
  currency_code: string | null
  image_url: string | null
  /** CJ category (`product_type`); absent when the column doesn't exist. */
  product_type?: string | null
}

/** A catalog row with its normalised text precomputed (the search index). */
export interface ProductIndexEntry {
  product: ShopProduct
  title: string
  titleWords: string[]
  haystack: string
  words: string[]
}

/** Splits a raw query into normalised, accent-free tokens (AND semantics). */
export function tokenizeQuery(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean)
}

/** Splits text into normalised, accent-free tokens (AND semantics). */
function wordsOf(value: string): string[] {
  return normalize(value).split(/\s+/).filter(Boolean)
}

/**
 * Builds the search index once per catalog load: normalisation (accents,
 * case) runs over every product here, so each keystroke only has to do
 * substring checks against already-clean text.
 */
export function buildProductIndex(products: ShopProduct[]): ProductIndexEntry[] {
  return products.map((product) => {
    const title = normalize(product.title ?? "")
    const description = product.description ?? ""
    return {
      product,
      title,
      titleWords: wordsOf(product.title ?? ""),
      haystack: normalize([product.title, description].filter(Boolean).join(" ")),
      words: wordsOf([product.title, description].filter(Boolean).join(" ")),
    }
  })
}

/** Levenshtein distance with early exit once every row exceeds `max`. */
function withinDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      rowMin = Math.min(rowMin, current[j])
    }
    if (rowMin > max) return false
    previous = current
  }
  return previous[b.length] <= max
}

/** True when any word is within `max` edits of the token (typo tolerance). */
function fuzzyIn(words: string[], token: string, max: number): boolean {
  for (const word of words) {
    if (withinDistance(word, token, max)) return true
  }
  return false
}

/**
 * Score of one token against one index entry; 0 means "no match". Title
 * hits rank above description hits, exact hits above fuzzy ones (typos are
 * tolerated from 4 characters, with a wider radius from 8).
 */
function tokenScore(entry: ProductIndexEntry, token: string): number {
  if (entry.title.includes(token)) return entry.title.startsWith(token) ? 6 : 4
  if (entry.haystack.includes(token)) return 2
  if (token.length >= 4) {
    const max = token.length >= 8 ? 2 : 1
    if (fuzzyIn(entry.titleWords, token, max)) return 3
    if (fuzzyIn(entry.words, token, max)) return 1
  }
  return 0
}

/**
 * Advanced query over the index: every token must match (AND), with fuzzy
 * fallback for typos; results are ranked by relevance and ties fall back to
 * natural (numeric-aware) title order.
 */
export function filterProducts(index: ProductIndexEntry[], query: string): ProductIndexEntry[] {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return index

  const scored: Array<{ entry: ProductIndexEntry; score: number }> = []
  for (const entry of index) {
    let score = 0
    let matchesAll = true
    for (const token of tokens) {
      const value = tokenScore(entry, token)
      if (value === 0) {
        matchesAll = false
        break
      }
      score += value
    }
    if (matchesAll) scored.push({ entry, score })
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.title.localeCompare(b.entry.title, undefined, { numeric: true }),
    )
    .map((item) => item.entry)
}

/**
 * Folds a string for search-highlighting while recording, for every folded
 * character, the original slice it came from — so matches found in the
 * accent-free/case-free form map back to exact (code-point safe) ranges.
 */
function foldWithMap(text: string): { folded: string; starts: number[]; ends: number[] } {
  let folded = ""
  const starts: number[] = []
  const ends: number[] = []
  let index = 0
  for (const char of text) {
    const next = index + char.length
    const decomposed = char
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
    for (const piece of decomposed) {
      folded += piece
      starts.push(index)
      ends.push(next)
    }
    index = next
  }
  return { folded, starts, ends }
}

interface HighlightedProps {
  text: string
  /** Normalised tokens from `tokenizeQuery` (empty = no highlighting). */
  tokens: string[]
  className?: string
}

/**
 * Renders `text` wrapping every occurrence of the query tokens in a `<mark>`
 * — accent- and case-insensitive, merging overlapping ranges.
 */
export function Highlighted({ text, tokens, className }: HighlightedProps) {
  if (!text || tokens.length === 0) return <>{text}</>

  const { folded, starts, ends } = foldWithMap(text)
  const ranges: Array<[number, number]> = []
  for (const token of tokens) {
    if (!token) continue
    let at = folded.indexOf(token)
    while (at !== -1) {
      ranges.push([starts[at], ends[at + token.length - 1]])
      at = folded.indexOf(token, at + token.length)
    }
  }
  if (ranges.length === 0) return <>{text}</>

  // Sort and merge overlapping ranges so the walk below is monotonic.
  ranges.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push(range)
  }

  const parts: ReactNode[] = []
  let cursor = 0
  for (const [start, end] of merged) {
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark key={start} className="bg-gold/20 rounded-sm text-inherit">
        {text.slice(start, end)}
      </mark>,
    )
    cursor = end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

interface ShopSearchProps {
  index: ProductIndexEntry[]
  query: string
  onQueryChange: (value: string) => void
  money: (value: number, currency: string) => string
  className?: string
}

/**
 * Storefront search with live suggestions, modelled after the home hero
 * search but extended: ranked suggestions with highlighted matches, typo
 * tolerance, a recent-searches panel and a match-count footer. The grid
 * below filters as you type; selecting a suggestion fills the input with the
 * product's title, narrowing the grid to it.
 */
export function ShopSearch({ index, query, onQueryChange, money, className }: ShopSearchProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const { items: storedRecents, mutate: mutateRecents } = useStoredList<string>(SHOP_RECENT_KEY)
  // Defensive: the shared store is generic, only keep real strings.
  const recents = storedRecents.filter((item): item is string => typeof item === "string")

  const tokens = useMemo(() => tokenizeQuery(query), [query])
  const matches = useMemo(
    () => (tokens.length > 0 ? filterProducts(index, query) : []),
    [index, query, tokens],
  )
  const suggestions = useMemo(() => matches.slice(0, MAX_SUGGESTIONS), [matches])

  const showSuggestions = open && tokens.length > 0 && suggestions.length > 0
  const showRecents = open && tokens.length === 0 && recents.length > 0
  const panelLength = showSuggestions ? suggestions.length : showRecents ? recents.length : 0

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

  function saveRecent(term: string) {
    const value = term.trim()
    if (!value) return
    mutateRecents((previous) =>
      [value, ...previous.filter((item) => normalize(item) !== normalize(value))].slice(
        0,
        MAX_RECENT_SEARCHES,
      ),
    )
  }

  function handleInputChange(value: string) {
    onQueryChange(value)
    setOpen(true)
    setActive(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false)
      setActive(-1)
      return
    }
    if (panelLength === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => (index + 1) % panelLength)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => (index - 1 + panelLength) % panelLength)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (active >= 0) {
      if (showSuggestions) {
        chooseProduct(suggestions[active].product)
        return
      }
      if (showRecents) {
        const term = recents[active]
        onQueryChange(term)
        saveRecent(term)
        setOpen(false)
        setActive(-1)
        return
      }
    }
    saveRecent(query)
    setOpen(false)
    setActive(-1)
  }

  function chooseProduct(product: ShopProduct) {
    const title = product.title ?? ""
    onQueryChange(title)
    saveRecent(title)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div ref={rootRef} className={cn("relative w-full max-w-xl", className)}>
      <form
        role="search"
        onSubmit={handleSubmit}
        className="border-cream/15 bg-cream/5 focus-within:border-gold flex w-full items-center gap-2 rounded-full border p-1.5 pl-5 backdrop-blur-md transition focus-within:shadow-[0_0_28px_-10px_rgba(224,176,68,0.55)]"
      >
        <Icon name="search" className="text-cream/40 size-4 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t("shop.search.placeholder")}
          aria-label={t("shop.search.label")}
          role="combobox"
          aria-expanded={showSuggestions || showRecents}
          aria-controls="shop-search-suggestions"
          aria-autocomplete="list"
          autoComplete="off"
          className="text-cream placeholder:text-cream/40 h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label={t("shop.search.clear")}
            onClick={() => {
              onQueryChange("")
              setOpen(false)
              setActive(-1)
            }}
            className="text-cream/50 hover:text-cream flex size-8 shrink-0 items-center justify-center rounded-full transition"
          >
            <Icon name="close" className="size-4" />
          </button>
        )}
      </form>

      {(showSuggestions || showRecents) && (
        <div className="border-cream/10 bg-ink-card/95 shadow-luxe absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border backdrop-blur-md">
          <ul
            id="shop-search-suggestions"
            role="listbox"
            aria-label={showSuggestions ? t("shop.search.suggestions") : t("shop.search.recent")}
            className="max-h-80 overflow-y-auto"
          >
            {showSuggestions
              ? suggestions.map(({ product }, position) => {
                  const price = Number(product.price) || 0
                  const currency = (product.currency_code ?? "usd").toUpperCase()
                  const priceLabel = money(price, currency)
                  const type = product.product_type?.trim()
                  return (
                    <li key={String(product.id)} role="option" aria-selected={active === position}>
                      <button
                        type="button"
                        onClick={() => chooseProduct(product)}
                        onMouseEnter={() => setActive(position)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                          active === position ? "bg-gold/10" : "hover:bg-cream/5",
                        )}
                      >
                        <span className="border-gold/25 bg-ink/70 relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt=""
                              fill
                              unoptimized
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : (
                            <Icon name="sparkles" className="text-gold size-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-cream block truncate text-sm font-medium">
                            <Highlighted text={product.title ?? "—"} tokens={tokens} />
                          </span>
                          <span className="text-cream/50 block truncate text-xs">
                            {type ? `${type} · ${priceLabel}` : priceLabel}
                          </span>
                        </span>
                        <Icon name="arrow-right" className="text-gold/60 size-4" />
                      </button>
                    </li>
                  )
                })
              : recents.map((term, position) => (
                  <li key={term} role="option" aria-selected={active === position}>
                    <button
                      type="button"
                      onClick={() => {
                        onQueryChange(term)
                        saveRecent(term)
                        setOpen(false)
                        setActive(-1)
                      }}
                      onMouseEnter={() => setActive(position)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                        active === position ? "bg-gold/10" : "hover:bg-cream/5",
                      )}
                    >
                      <span className="border-cream/15 bg-ink/70 text-cream/50 flex size-9 shrink-0 items-center justify-center rounded-full border">
                        <Icon name="clock" className="size-4" />
                      </span>
                      <span className="text-cream/70 min-w-0 flex-1 truncate text-sm">{term}</span>
                      <Icon name="arrow-right" className="text-gold/60 size-4" />
                    </button>
                  </li>
                ))}
          </ul>
          <div className="border-cream/10 flex items-center justify-between gap-2 border-t px-4 py-2 text-xs">
            <span className="text-cream/45">
              {showSuggestions
                ? t("shop.search.matches", { total: matches.length })
                : t("shop.search.recent")}
            </span>
            {showRecents && (
              <button
                type="button"
                onClick={() => mutateRecents([])}
                className="text-gold font-medium hover:underline"
              >
                {t("shop.search.recentClear")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
