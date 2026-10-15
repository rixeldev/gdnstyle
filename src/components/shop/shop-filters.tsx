"use client"

import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Select } from "@/components/ui/select"
import type { ShopProduct } from "@/components/shop/shop-search"
import { cn } from "@/utils/cn"

export type SortKey = "relevance" | "priceAsc" | "priceDesc" | "nameAsc" | "nameDesc"

export type PriceRangeKey = "all" | "u25" | "r25t50" | "r50t100" | "o100"

/** Sentinel bucket for rows whose CJ `product_type` is missing or numeric. */
export const OTHER_CATEGORY = "__others__"

const SORT_OPTIONS: { key: SortKey; labelKey: string }[] = [
  { key: "relevance", labelKey: "shop.filters.sortRelevance" },
  { key: "priceAsc", labelKey: "shop.filters.sortPriceAsc" },
  { key: "priceDesc", labelKey: "shop.filters.sortPriceDesc" },
  { key: "nameAsc", labelKey: "shop.filters.sortNameAsc" },
  { key: "nameDesc", labelKey: "shop.filters.sortNameDesc" },
]

const PRICE_OPTIONS: { key: PriceRangeKey; labelKey: string }[] = [
  { key: "all", labelKey: "shop.filters.all" },
  { key: "u25", labelKey: "shop.filters.priceUnder25" },
  { key: "r25t50", labelKey: "shop.filters.price25to50" },
  { key: "r50t100", labelKey: "shop.filters.price50to100" },
  { key: "o100", labelKey: "shop.filters.priceOver100" },
]

/**
 * Extracts the browse bucket from a raw CJ `product_type`. Those values are
 * full paths written inconsistently (`A/B/C`, `A / B / C`, `A > B > C`), so
 * the **second level** is taken: it merges the separator variants and drops
 * the noisy top level. Missing or numeric junk (CJ writes `5`, `0`, …) maps
 * to the "others" bucket.
 */
export function categoryBucket(raw: string | null | undefined): string {
  const value = raw?.trim()
  if (!value) return OTHER_CATEGORY
  const segments = value
    .split(/\s*(?:\/|>)\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (segments.length === 0) return OTHER_CATEGORY
  const candidate = segments.length > 1 ? segments[1] : segments[0]
  // Numeric codes are not category names.
  if (/^[\d.,\s]+$/.test(candidate)) return OTHER_CATEGORY
  return candidate
}

/** Whether a unit price falls inside the selected preset (USD catalogue). */
export function matchesPriceRange(price: number, range: PriceRangeKey): boolean {
  switch (range) {
    case "u25":
      return price < 25
    case "r25t50":
      return price >= 25 && price < 50
    case "r50t100":
      return price >= 50 && price < 100
    case "o100":
      return price >= 100
    default:
      return true
  }
}

/** Sorts a result set; "relevance" keeps the incoming (search) order. */
export function sortProducts(products: ShopProduct[], sort: SortKey): ShopProduct[] {
  if (sort === "relevance") return products
  const list = [...products]
  switch (sort) {
    case "priceAsc":
      return list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
    case "priceDesc":
      return list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
    case "nameAsc":
      return list.sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", undefined, { numeric: true }),
      )
    case "nameDesc":
      return list.sort((a, b) =>
        (b.title ?? "").localeCompare(a.title ?? "", undefined, { numeric: true }),
      )
    default:
      return list
  }
}

interface ShopFiltersProps {
  /** Distinct browse buckets present in the loaded catalog (deduped). */
  categories: string[]
  /** Whether an "others" bucket (missing/numeric `product_type`) exists. */
  hasOthers: boolean
  category: string
  onCategoryChange: (value: string) => void
  priceRange: PriceRangeKey
  onPriceRangeChange: (value: PriceRangeKey) => void
  sort: SortKey
  onSortChange: (value: SortKey) => void
  /** Number of non-default filters (for the "clear" affordance). */
  activeCount: number
  onClear: () => void
  className?: string
}

const LABEL_CLASS = "text-cream/40 text-[11px] tracking-[0.16em] uppercase"

/**
 * Shop toolbar (single row), modelled after the venue directory but kept
 * minimal on purpose: three compact selects — category (derived from the
 * catalog's `product_type` paths), price presets and sort — plus a clear
 * button while any of them is off its default. Everything composes with the
 * search box; clearing filters never touches the query.
 */
export function ShopFilters({
  categories,
  hasOthers,
  category,
  onCategoryChange,
  priceRange,
  onPriceRangeChange,
  sort,
  onSortChange,
  activeCount,
  onClear,
  className,
}: ShopFiltersProps) {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t("shop.filters.title")}
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-3", className)}
    >
      {categories.length > 0 && (
        <label className="inline-flex items-center gap-2 text-xs">
          <span className={LABEL_CLASS}>{t("shop.filters.categoryLabel")}</span>
          <Select
            value={category}
            options={[
              { value: "all", label: t("shop.filters.allCategories") },
              ...categories.map((value) => ({ value, label: value })),
              ...(hasOthers ? [{ value: OTHER_CATEGORY, label: t("shop.filters.others") }] : []),
            ]}
            onChange={onCategoryChange}
            ariaLabel={t("shop.filters.categoryLabel")}
            active={category !== "all"}
          />
        </label>
      )}

      <label className="inline-flex items-center gap-2 text-xs">
        <span className={LABEL_CLASS}>{t("shop.filters.priceLabel")}</span>
        <Select
          value={priceRange}
          options={PRICE_OPTIONS.map((item) => ({ value: item.key, label: t(item.labelKey) }))}
          onChange={(value) => onPriceRangeChange(value as PriceRangeKey)}
          ariaLabel={t("shop.filters.priceLabel")}
          active={priceRange !== "all"}
        />
      </label>

      <label className="inline-flex items-center gap-2 text-xs">
        <Icon name="sliders" className="text-cream/40 size-4" />
        <span className={LABEL_CLASS}>{t("shop.filters.sortLabel")}</span>
        <Select
          value={sort}
          options={SORT_OPTIONS.map((item) => ({ value: item.key, label: t(item.labelKey) }))}
          onChange={(value) => onSortChange(value as SortKey)}
          ariaLabel={t("shop.filters.sortLabel")}
          active={sort !== "relevance"}
        />
      </label>

      {activeCount > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          iconLeft={<Icon name="close" className="size-4" />}
        >
          {t("shop.filters.clear")}
        </Button>
      )}
    </section>
  )
}
