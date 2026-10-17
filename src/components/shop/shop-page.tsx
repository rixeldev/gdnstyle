"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import {
  OTHER_CATEGORY,
  ShopFilters,
  categoryBucket,
  matchesPriceRange,
  sortProducts,
  type PriceRangeKey,
  type SortKey,
} from "@/components/shop/shop-filters"
import {
  Highlighted,
  ShopSearch,
  buildProductIndex,
  filterProducts,
  tokenizeQuery,
  type ShopProduct,
} from "@/components/shop/shop-search"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Modal } from "@/components/ui/modal"
import { StripePaymentCardForm, STRIPE_PUBLISHABLE_KEY } from "@/components/ui/stripe-elements"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { useShopCart, type CartLine } from "@/hooks/use-shop-cart"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { createShopCheckout } from "@/services/payments.service"
import {
  fetchRemoteCart,
  listShippingAddresses,
  saveRemoteCart,
  saveShippingAddress,
  type ShippingAddress,
} from "@/services/shop.service"
import { cn } from "@/utils/cn"
import { toIntlLocale } from "@/utils/format"
import { normalize } from "@/utils/normalize"

/**
 * Storefront backed by the `products` table and the shop Edge Functions:
 * `create-stripe-checkout` creates the PaymentIntent + tracking row, and the
 * deployed `stripe-webhook` turns the payment into an order (and hands it to
 * CJ Dropshipping when configured).
 *
 * The cart lives in localStorage (`useShopCart`), so the header badge and
 * this page always agree; checkout opens the dialog with shipping + Stripe.
 */
export function ShopPage() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const locale = toIntlLocale(i18n.language)
  const supabase = getSupabaseBrowserClient()
  const { user } = useSession()
  const userId = user?.id ?? null
  const cart = useShopCart()

  const [products, setProducts] = useState<ShopProduct[] | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [catalogError, setCatalogError] = useState(false)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [priceRange, setPriceRange] = useState<PriceRangeKey>("all")
  const [sort, setSort] = useState<SortKey>("relevance")
  // Marks the user whose DB↔local cart merge already completed (see below).
  const mergedForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    const BASIC = "id, title, description, price, currency_code, image_url"
    const EXTENDED = `${BASIC}, product_type`
    let active = true
    // Extended projection first (category chips come from `product_type`);
    // if the table predates those columns, fall back to the basic one so the
    // catalog keeps loading — the category filter then simply hides itself.
    void supabase
      .from("products")
      .select(EXTENDED)
      .order("title", { ascending: true })
      .limit(48)
      .then(async ({ data, error }) => {
        if (!active) return
        if (!error) {
          setProducts((data ?? []) as ShopProduct[])
          return
        }
        const fallback = await supabase
          .from("products")
          .select(BASIC)
          .order("title", { ascending: true })
          .limit(48)
        if (!active) return
        if (fallback.error) {
          setCatalogError(true)
          setProducts([])
          return
        }
        setProducts((fallback.data ?? []) as ShopProduct[])
      })
    return () => {
      active = false
    }
  }, [supabase])

  // Server-side cart (migration 0004). On sign-in the DB cart and the local
  // one are merged (max quantity per line, union of lines) *before* any
  // mirroring starts, so remote rows are never overwritten unread. From then
  // on every local change is mirrored; RLS scopes the rows to the user.
  // `mergedForRef` records who completed the merge: a failed or interrupted
  // merge simply retries on the next change.
  useEffect(() => {
    if (!userId) {
      mergedForRef.current = null
      return
    }
    // Wait for hydration: `cart.lines` is empty until the client snapshot lands.
    if (!cart.ready || !supabase) return
    const alreadyMerged = mergedForRef.current === userId
    let active = true
    void (async () => {
      try {
        if (alreadyMerged) {
          await saveRemoteCart(cart.lines)
          return
        }
        const remote = await fetchRemoteCart()
        if (!active) return
        const merged = new Map<string, number>()
        for (const line of remote) merged.set(String(line.productId), line.quantity)
        for (const line of cart.lines) {
          const id = String(line.productId)
          merged.set(id, Math.max(merged.get(id) ?? 0, line.quantity))
        }
        const next = [...merged].map(([productId, quantity]) => ({ productId, quantity }))
        const changed =
          next.length !== cart.lines.length ||
          next.some(
            (line) =>
              !cart.lines.some(
                (item) =>
                  String(item.productId) === line.productId && item.quantity === line.quantity,
              ),
          )
        mergedForRef.current = userId
        if (changed) {
          // Re-running this effect with the merged list performs the mirror.
          cart.replace(next)
        } else {
          await saveRemoteCart(next)
        }
      } catch {
        // DB not ready (offline / migration 0004 pending): keep the local cart
        // and retry on the next change; remote state is never overwritten.
      }
    })()
    return () => {
      active = false
    }
  }, [cart.lines, cart.ready, cart.replace, supabase, userId])

  const money = (value: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value)
    } catch {
      return `$${value.toFixed(2)}`
    }
  }

  // Search index built once per catalog load. The grid composes three
  // stages: text search (relevance order) → category/price filters → sort.
  const productIndex = useMemo(() => buildProductIndex(products ?? []), [products])
  // Browse buckets: the second level of each CJ `product_type` path (which
  // also merges the separator variants), deduped case-insensitively.
  const categories = useMemo(() => {
    const seen = new Map<string, string>()
    for (const product of products ?? []) {
      const bucket = categoryBucket(product.product_type)
      if (bucket === OTHER_CATEGORY) continue
      const key = normalize(bucket)
      if (!seen.has(key)) seen.set(key, bucket)
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [products])
  const hasOthers = useMemo(
    () =>
      (products ?? []).some((product) => categoryBucket(product.product_type) === OTHER_CATEGORY),
    [products],
  )
  const searchMatches = useMemo(
    () => (query.trim() ? filterProducts(productIndex, query) : productIndex),
    [productIndex, query],
  )
  const catalog = useMemo(() => {
    let list = searchMatches.map((entry) => entry.product)
    if (category !== "all") {
      // Compare normalised so casing variants of a bucket still match.
      const wanted = normalize(category)
      list = list.filter((product) => normalize(categoryBucket(product.product_type)) === wanted)
    }
    if (priceRange !== "all") {
      list = list.filter((product) => matchesPriceRange(Number(product.price) || 0, priceRange))
    }
    return sortProducts(list, sort)
  }, [searchMatches, category, priceRange, sort])
  const highlightTokens = useMemo(() => tokenizeQuery(query), [query])
  const activeFilterCount =
    (category !== "all" ? 1 : 0) + (priceRange !== "all" ? 1 : 0) + (sort !== "relevance" ? 1 : 0)
  const hasCriteria = Boolean(query.trim()) || activeFilterCount > 0

  const cartLines = cart.lines
    .map((line) => {
      const product = catalog.find((item) => String(item.id) === String(line.productId))
      if (!product) return null
      return { line, product }
    })
    .filter((entry): entry is { line: CartLine; product: ShopProduct } => entry !== null)

  const total = cartLines.reduce(
    (sum, entry) => sum + (Number(entry.product.price) || 0) * entry.line.quantity,
    0,
  )

  function clearFilters() {
    setCategory("all")
    setPriceRange("all")
    setSort("relevance")
  }

  function resetAll() {
    setQuery("")
    clearFilters()
  }

  function openCheckout() {
    setCartOpen(false)
    // Guests cannot check out: send them to login and bring them back after.
    if (!user) {
      toast(t("shop.signInHint"))
      router.push(`/auth/login?role=customer&next=${encodeURIComponent("/shop")}`)
      return
    }
    setCheckoutOpen(true)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pt-24 pb-28 md:px-8 md:pt-28">
      {/* Hero band */}
      <section className="border-cream/10 bg-ink-card relative overflow-hidden rounded-4xl border px-6 py-10 md:px-10 md:py-14">
        <div
          aria-hidden="true"
          className="bg-gold/12 absolute -top-24 -right-20 size-72 rounded-full blur-3xl"
        />
        <div
          aria-hidden="true"
          className="bg-plum/40 absolute -bottom-28 -left-16 size-72 rounded-full blur-3xl"
        />
        <div className="relative max-w-2xl">
          <span className="border-gold/30 bg-gold/10 text-gold inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide uppercase">
            <Icon name="store" className="size-3.5" />
            {t("shop.kicker")}
          </span>
          <h1 className="font-display mt-4 text-3xl font-semibold md:text-4xl">
            {t("shop.title")}
          </h1>
          <p className="text-cream/60 mt-3 text-sm leading-relaxed md:text-base">
            {t("shop.body")}
          </p>
          <div className="text-cream/50 mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="shield" className="text-gold size-4" />
              {t("shop.trustSecure")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="shopping-bag" className="text-gold size-4" />
              {t("shop.trustShipping")}
            </span>
          </div>
        </div>
      </section>

      <ShopSearch
        index={productIndex}
        query={query}
        onQueryChange={setQuery}
        money={money}
        className="mt-6"
      />

      <ShopFilters
        categories={categories}
        hasOthers={hasOthers}
        category={category}
        onCategoryChange={setCategory}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        sort={sort}
        onSortChange={setSort}
        activeCount={activeFilterCount}
        onClear={clearFilters}
        className="mt-6"
      />

      {!supabase && (
        <Alert tone="info" className="mt-6">
          {t("shop.demoUnavailable")}
        </Alert>
      )}
      {catalogError && (
        <Alert tone="error" className="mt-6">
          {t("shop.catalogError")}
        </Alert>
      )}

      {supabase && products === null ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="bg-cream/5 h-80 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : (
        <>
          {hasCriteria && products !== null && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-cream/60 text-sm">
                {t("shop.search.results", { total: catalog.length })}
              </p>
              <div className="flex items-center gap-3">
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-gold text-sm font-medium hover:underline"
                  >
                    {t("shop.search.clear")}
                  </button>
                )}
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-gold text-sm font-medium hover:underline"
                  >
                    {t("shop.filters.clear")}
                  </button>
                )}
              </div>
            </div>
          )}
          {catalog.length > 0 ? (
            <ul
              className={cn(
                "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
                hasCriteria ? "mt-4" : "mt-8",
              )}
            >
              {catalog.map((product) => {
                const price = Number(product.price) || 0
                const currency = (product.currency_code ?? "usd").toUpperCase()
                const inCart = cart.lines.find(
                  (line) => String(line.productId) === String(product.id),
                )
                return (
                  <li
                    key={String(product.id)}
                    className="border-cream/10 bg-ink-card group hover:border-gold/40 relative flex flex-col overflow-hidden rounded-3xl border transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(224,176,68,0.45)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.title ?? t("shop.title")}
                          fill
                          unoptimized
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="from-cream/6 to-cream/2 flex h-full items-center justify-center bg-gradient-to-br to-transparent">
                          <Icon name="sparkles" className="text-gold/30 size-10" />
                        </div>
                      )}
                      <div
                        aria-hidden="true"
                        className="from-ink/60 absolute inset-0 bg-gradient-to-t to-transparent"
                      />
                      <span className="border-gold/40 bg-ink/80 text-gold absolute top-3 right-3 rounded-full border px-3 py-1 text-sm font-semibold backdrop-blur-sm">
                        {money(price, currency)}
                      </span>
                      {inCart && inCart.quantity > 0 && (
                        <span className="bg-gold text-gold-ink absolute top-3 left-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold">
                          ×{inCart.quantity}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="text-cream group-hover:text-gold text-base font-semibold transition">
                        <Highlighted text={product.title ?? "—"} tokens={highlightTokens} />
                      </h2>
                      {product.description && (
                        <p className="text-cream/50 mt-1.5 line-clamp-2 text-sm leading-relaxed">
                          <Highlighted text={product.description} tokens={highlightTokens} />
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                        <span className="text-gold text-sm font-semibold md:hidden">
                          {money(price, currency)}
                        </span>
                        {inCart ? (
                          <QuantityStepper
                            value={inCart.quantity}
                            onDecrease={() =>
                              cart.setQuantity(String(product.id), inCart.quantity - 1)
                            }
                            onIncrease={() =>
                              cart.setQuantity(String(product.id), inCart.quantity + 1)
                            }
                          />
                        ) : (
                          <Button
                            size="sm"
                            disabled={!supabase}
                            onClick={() => cart.add(product.id)}
                            iconLeft={<Icon name="plus" className="size-4" />}
                          >
                            {t("shop.add")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : hasCriteria ? (
            <div className="border-cream/10 mt-8 flex flex-col items-center gap-4 rounded-3xl border border-dashed px-6 py-12 text-center">
              <Icon name="search" className="text-cream/25 size-7" />
              <p className="text-cream/55 text-sm">
                {query.trim()
                  ? t("shop.search.noResults", { query: query.trim() })
                  : t("shop.filters.noResults")}
              </p>
              <Button size="sm" variant="ghost" onClick={resetAll}>
                {t("shop.search.clearAll")}
              </Button>
            </div>
          ) : (
            <div className="border-cream/10 mt-8 flex flex-col items-center gap-4 rounded-3xl border border-dashed px-6 py-12 text-center">
              <Icon name="sparkles" className="text-cream/25 size-7" />
              <p className="text-cream/55 text-sm">{t("shop.empty")}</p>
            </div>
          )}
        </>
      )}

      {/* Floating cart pill */}
      {cart.count > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="border-gold/40 bg-gold text-gold-ink hover:bg-gold-soft fixed right-5 bottom-5 z-40 inline-flex items-center gap-2.5 rounded-full border px-5 py-3 text-sm font-semibold shadow-[0_16px_40px_-12px_rgba(224,176,68,0.6)] transition md:right-8 md:bottom-8"
        >
          <span className="relative">
            <Icon name="shopping-bag" className="size-5" />
            <span className="bg-ink text-gold absolute -top-2 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
              {cart.count}
            </span>
          </span>
          {t("shop.viewCart")} · {money(total, "USD")}
        </button>
      )}

      {cartOpen && (
        <CartDrawer
          lines={cartLines}
          total={total}
          money={money}
          onDecrease={(id) => {
            const entry = cart.lines.find((line) => String(line.productId) === String(id))
            cart.setQuantity(id, (entry?.quantity ?? 1) - 1)
          }}
          onIncrease={(id) => cart.add(id)}
          onRemove={(id) => cart.removeLine(id)}
          onClear={() => cart.clear()}
          onCheckout={openCheckout}
          onClose={() => setCartOpen(false)}
        />
      )}

      {checkoutOpen && (
        <CheckoutDialog
          lines={cartLines}
          total={total}
          money={money}
          userId={user?.id ?? null}
          onClose={() => setCheckoutOpen(false)}
          onPaid={() => cart.clear()}
        />
      )}
    </main>
  )
}

interface QuantityStepperProps {
  value: number
  onDecrease: () => void
  onIncrease: () => void
  compact?: boolean
}

/** Round −/qty/+ control used in cards and in the cart drawer. */
function QuantityStepper({ value, onDecrease, onIncrease, compact }: QuantityStepperProps) {
  const { t } = useTranslation()
  const size = compact ? "size-7" : "size-8"
  const icon = compact ? "size-3.5" : "size-4"
  return (
    <div className="border-cream/15 bg-cream/5 inline-flex items-center gap-1 rounded-full border p-1">
      <button
        type="button"
        aria-label={t("shop.decrease")}
        onClick={onDecrease}
        className={cn(
          "text-cream/70 hover:text-cream hover:bg-cream/10 flex items-center justify-center rounded-full transition",
          size,
        )}
      >
        <Icon name="minus" className={icon} />
      </button>
      <span className="text-cream min-w-5 text-center text-sm font-semibold">{value}</span>
      <button
        type="button"
        aria-label={t("shop.increase")}
        onClick={onIncrease}
        className={cn(
          "text-cream/70 hover:text-cream hover:bg-cream/10 flex items-center justify-center rounded-full transition",
          size,
        )}
      >
        <Icon name="plus" className={icon} />
      </button>
    </div>
  )
}

interface CartDrawerProps {
  lines: Array<{ line: CartLine; product: ShopProduct }>
  total: number
  money: (value: number, currency: string) => string
  onDecrease: (productId: string) => void
  onIncrease: (productId: string) => void
  onRemove: (productId: string) => void
  onClear: () => void
  onCheckout: () => void
  onClose: () => void
}

/** Slide-in cart panel, themed like the rest of the page. */
function CartDrawer({
  lines,
  total,
  money,
  onDecrease,
  onIncrease,
  onRemove,
  onClear,
  onCheckout,
  onClose,
}: CartDrawerProps) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onClose])

  // Lock background scrolling while the drawer is open.
  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={t("shop.cartTitle")}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "bg-ink/70 absolute inset-0 backdrop-blur-sm transition-opacity duration-300",
          shown ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        className={cn(
          "border-cream/10 bg-ink-card absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l shadow-2xl transition-transform duration-300 ease-out",
          shown ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="border-cream/10 flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
            <Icon name="shopping-bag" className="text-gold size-5" />
            {t("shop.cartTitle")}
            <span className="text-cream/40 text-sm font-normal">
              · {t("shop.cartWithCount", { count: lines.reduce((s, l) => s + l.line.quantity, 0) })}
            </span>
          </h2>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            className="text-cream/60 hover:text-cream hover:bg-cream/10 flex size-9 items-center justify-center rounded-full transition"
          >
            <Icon name="close" className="size-5" />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="text-cream/55 flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <Icon name="shopping-bag" className="text-cream/20 size-9" />
            <p className="text-sm">{t("shop.cartEmpty")}</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("shop.continueShopping")}
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {lines.map(({ line, product }) => {
                const price = Number(product.price) || 0
                const currency = (product.currency_code ?? "usd").toUpperCase()
                return (
                  <li
                    key={String(product.id)}
                    className="border-cream/10 bg-cream/2 flex gap-3 rounded-2xl border p-3"
                  >
                    <div className="bg-cream/5 relative h-18 w-18 shrink-0 overflow-hidden rounded-xl">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.title ?? t("shop.title")}
                          fill
                          unoptimized
                          sizes="72px"
                          className="object-cover"
                        />
                      ) : (
                        <Icon
                          name="sparkles"
                          className="text-gold/30 absolute inset-0 m-auto size-6"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-cream truncate text-sm font-semibold">
                          {product.title ?? "—"}
                        </h3>
                        <button
                          type="button"
                          aria-label={t("shop.remove")}
                          onClick={() => onRemove(String(product.id))}
                          className="text-cream/40 shrink-0 transition hover:text-red-300"
                        >
                          <Icon name="trash" className="size-4" />
                        </button>
                      </div>
                      <p className="text-gold mt-0.5 text-sm font-semibold">
                        {money(price, currency)}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <QuantityStepper
                          compact
                          value={line.quantity}
                          onDecrease={() => onDecrease(String(product.id))}
                          onIncrease={() => onIncrease(String(product.id))}
                        />
                        <span className="text-cream/70 text-sm font-medium">
                          {money(price * line.quantity, currency)}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            <footer className="border-cream/10 border-t px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-cream/60">{t("shop.subtotal")}</span>
                <span className="text-gold text-base font-semibold">{money(total, "USD")}</span>
              </div>
              <Button
                className="mt-3 w-full"
                onClick={onCheckout}
                iconLeft={<Icon name="shield" className="size-4" />}
              >
                {t("shop.checkout")}
              </Button>
              <div className="mt-1 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  iconLeft={<Icon name="trash" className="size-4" />}
                >
                  {t("shop.clearCart")}
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  {t("shop.continueShopping")}
                </Button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}

interface CheckoutDialogProps {
  lines: Array<{ line: CartLine; product: ShopProduct }>
  total: number
  money: (value: number, currency: string) => string
  userId: string | null
  onClose: () => void
  onPaid: () => void
}

function CheckoutDialog({ lines, total, money, userId, onClose, onPaid }: CheckoutDialogProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const titleId = useId()
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "US",
    postalCode: "",
  })
  const [addresses, setAddresses] = useState<ShippingAddress[] | null>(null)
  // `null` = "otra dirección" (the manual form); otherwise a saved address id.
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [saveAddress, setSaveAddress] = useState(true)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Load the saved address book; the default (first) one is preselected and
  // the form fields are filled from it.
  useEffect(() => {
    if (!userId) return
    let active = true
    listShippingAddresses()
      .then((list) => {
        if (!active) return
        setAddresses(list)
        const first = list[0]
        if (first) selectAddress(first)
      })
      .catch(() => {
        if (active) setAddresses([])
      })
    return () => {
      active = false
    }
  }, [userId])

  function selectAddress(address: ShippingAddress | null) {
    if (!address) {
      setSelectedAddressId(null)
      return
    }
    setSelectedAddressId(address.id)
    setValues((current) => ({
      ...current,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      address: address.address,
      city: address.city,
      country: address.country,
      postalCode: address.postalCode ?? "",
    }))
  }

  function handleChange(field: keyof typeof values) {
    return (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await createShopCheckout({
        cartItems: lines.map(({ line }) => ({
          productId: String(line.productId),
          quantity: line.quantity,
        })),
        shippingInfo: values,
      })
      if (!result.paymentIntent) {
        setMessage(t("common.tryAgain"))
        return
      }
      // Persist a newly typed address (best effort — never blocks payment).
      if (selectedAddressId === null && saveAddress) {
        try {
          await saveShippingAddress({
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone,
            address: values.address,
            city: values.city,
            country: values.country,
            postalCode: values.postalCode || null,
          })
        } catch {
          /* address book unavailable: the order itself is unaffected */
        }
      }
      setClientSecret(result.paymentIntent)
    } catch (error) {
      setMessage((error as Error).message || t("common.tryAgain"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId} className="max-w-xl">
      <div className="max-h-[80vh] overflow-y-auto p-5">
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {t("shop.checkoutTitle")}
        </h2>

        {done ? (
          <div className="mt-5 text-center">
            <Icon name="check-circle" className="text-gold mx-auto size-9" />
            <p className="text-cream/80 mt-3 text-sm">{t("shop.paidNote")}</p>
            <Button className="mt-5" size="sm" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        ) : clientSecret && STRIPE_PUBLISHABLE_KEY ? (
          <div className="mt-5">
            <StripePaymentCardForm
              clientSecret={clientSecret}
              buttonLabel={t("shop.pay")}
              onSuccess={() => {
                onPaid()
                setDone(true)
              }}
              onError={(value) => setMessage(value)}
            />
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleCreate}>
            {/* Order summary */}
            <ul className="border-cream/10 bg-cream/3 space-y-2 rounded-2xl border px-4 py-3">
              {lines.map(({ line, product }) => {
                const price = Number(product.price) || 0
                const currency = (product.currency_code ?? "usd").toUpperCase()
                return (
                  <li
                    key={String(product.id)}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-cream/70 min-w-0 truncate">
                      <span className="text-gold mr-1.5 font-semibold">×{line.quantity}</span>
                      {product.title ?? "—"}
                    </span>
                    <span className="text-cream/80 shrink-0 font-medium">
                      {money(price * line.quantity, currency)}
                    </span>
                  </li>
                )
              })}
              <li className="border-cream/10 flex items-center justify-between border-t pt-2 text-sm">
                <span className="text-cream/60">{t("shop.total")}</span>
                <span className="text-gold font-semibold">{money(total, "USD")}</span>
              </li>
            </ul>

            {/* Address book (saved shipping addresses) */}
            {(addresses?.length ?? 0) > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-cream/70 mb-1.5 text-sm font-medium">
                  {t("shop.savedAddresses")}
                </legend>
                {addresses?.map((address) => (
                  <label
                    key={address.id}
                    className={cn(
                      "border-cream/10 bg-cream/3 flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                      selectedAddressId === address.id
                        ? "border-gold/50 bg-gold/5"
                        : "hover:border-cream/25",
                    )}
                  >
                    <input
                      type="radio"
                      name="shippingAddress"
                      className="accent-gold mt-0.5"
                      checked={selectedAddressId === address.id}
                      onChange={() => selectAddress(address)}
                    />
                    <span className="min-w-0">
                      <span className="text-cream block font-medium">
                        {address.firstName} {address.lastName} · {address.city}
                        {address.isDefault && (
                          <span className="text-gold/80 ml-2 text-xs font-normal">
                            {t("dashboard.customer.payments.defaultBadge")}
                          </span>
                        )}
                      </span>
                      <span className="text-cream/50 block text-xs">
                        {address.address}
                        {address.postalCode ? ` · ${address.postalCode}` : ""} · {address.phone}
                      </span>
                    </span>
                  </label>
                ))}
                <label
                  className={cn(
                    "border-cream/10 bg-cream/3 flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                    selectedAddressId === null
                      ? "border-gold/50 bg-gold/5"
                      : "hover:border-cream/25",
                  )}
                >
                  <input
                    type="radio"
                    name="shippingAddress"
                    className="accent-gold"
                    checked={selectedAddressId === null}
                    onChange={() => selectAddress(null)}
                  />
                  <span className="text-cream">{t("shop.otherAddress")}</span>
                </label>
              </fieldset>
            )}

            {/* Manual form: only when no saved address is selected. */}
            {selectedAddressId === null && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t("shop.firstName")}
                    value={values.firstName}
                    onChange={handleChange("firstName")}
                    autoComplete="given-name"
                    required
                  />
                  <TextField
                    label={t("shop.lastName")}
                    value={values.lastName}
                    onChange={handleChange("lastName")}
                    autoComplete="family-name"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t("shop.email")}
                    type="email"
                    value={values.email}
                    onChange={handleChange("email")}
                    autoComplete="email"
                    required
                  />
                  <TextField
                    label={t("shop.phone")}
                    value={values.phone}
                    onChange={handleChange("phone")}
                    autoComplete="tel"
                    required
                  />
                </div>
                <TextField
                  label={t("shop.address")}
                  value={values.address}
                  onChange={handleChange("address")}
                  autoComplete="street-address"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField
                    label={t("shop.city")}
                    value={values.city}
                    onChange={handleChange("city")}
                    autoComplete="address-level2"
                    required
                  />
                  <TextField
                    label={t("shop.country")}
                    value={values.country}
                    onChange={handleChange("country")}
                    autoComplete="country"
                    required
                  />
                  <TextField
                    label={t("shop.postalCode")}
                    value={values.postalCode}
                    onChange={handleChange("postalCode")}
                    autoComplete="postal-code"
                  />
                </div>
                <label className="text-cream/70 flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="accent-gold"
                    checked={saveAddress}
                    onChange={(event) => setSaveAddress(event.target.checked)}
                  />
                  {t("shop.saveAddress")}
                </label>
              </>
            )}

            {!userId && (
              <div className="flex flex-col items-center gap-3">
                <Alert tone="info">{t("shop.signInHint")}</Alert>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    router.push(`/auth/login?role=customer&next=${encodeURIComponent("/shop")}`)
                  }
                >
                  {t("nav.signIn")}
                </Button>
              </div>
            )}

            {message && <Alert tone="error">{message}</Alert>}

            {userId && (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" size="sm" loading={busy}>
                  {t("shop.continue")}
                </Button>
              </div>
            )}
          </form>
        )}

        {message && clientSecret && <p className="text-danger mt-3 text-sm">{message}</p>}
      </div>
    </Modal>
  )
}
