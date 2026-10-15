"use client"

import { useCallback } from "react"

import { useStoredList } from "@/hooks/use-stored-list"

/** localStorage key shared by the shop page and the header cart badge. */
export const SHOP_CART_KEY = "gdn.shop.cart"

/** One cart line; product data stays in the catalog, only the id travels. */
export interface CartLine {
  productId: string
  quantity: number
}

/**
 * Storefront cart persisted in localStorage and shared app-wide (the header
 * badge and the shop page observe the same list through `useStoredList`).
 *
 * Comparisons stringify both sides: older carts stored the raw (possibly
 * numeric) product id, so `5 !== "5"` must not orphan those lines.
 */
export function useShopCart() {
  const { items, ready, mutate } = useStoredList<CartLine>(SHOP_CART_KEY)

  const add = useCallback(
    (productId: string | number) => {
      const id = String(productId)
      mutate((previous) => {
        if (previous.some((line) => String(line.productId) === id)) {
          return previous.map((line) =>
            String(line.productId) === id ? { ...line, quantity: line.quantity + 1 } : line,
          )
        }
        return [...previous, { productId: id, quantity: 1 }]
      })
    },
    [mutate],
  )

  const setQuantity = useCallback(
    (productId: string | number, quantity: number) => {
      const id = String(productId)
      mutate((previous) =>
        quantity <= 0
          ? previous.filter((line) => String(line.productId) !== id)
          : previous.map((line) => (String(line.productId) === id ? { ...line, quantity } : line)),
      )
    },
    [mutate],
  )

  const removeLine = useCallback(
    (productId: string | number) => {
      const id = String(productId)
      mutate((previous) => previous.filter((line) => String(line.productId) !== id))
    },
    [mutate],
  )

  const clear = useCallback(() => mutate([]), [mutate])

  /** Wholesale replace (used by the DB sync merge). */
  const replace = useCallback((next: CartLine[]) => mutate(next), [mutate])

  const count = items.reduce((sum, line) => sum + line.quantity, 0)

  return { lines: items, ready, add, setQuantity, removeLine, clear, replace, count }
}
