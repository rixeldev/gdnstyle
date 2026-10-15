import type { CartLine } from "@/hooks/use-shop-cart"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"

/**
 * Client-side shop persistence (migration `0004_shop_persistence.sql`):
 * saved shipping addresses and the server-side cart mirror. Every table is
 * RLS-scoped to `auth.uid()`, so plain browser queries are safe and no Edge
 * Function is needed for these reads/writes.
 */

export interface ShippingAddress {
  id: string
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  country: string
  postalCode: string | null
  isDefault: boolean
}

export type ShippingAddressInput = Omit<ShippingAddress, "id" | "isDefault">

interface AddressRow {
  id: string
  first_name: string
  last_name: string
  phone: string
  address: string
  city: string
  country: string
  postal_code: string | null
  is_default: boolean
}

function mapAddress(row: AddressRow): ShippingAddress {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    country: row.country,
    postalCode: row.postal_code,
    isDefault: row.is_default,
  }
}

const ADDRESS_COLUMNS =
  "id, first_name, last_name, phone, address, city, country, postal_code, is_default"

/** The signed-in user's saved addresses, default first. */
export async function listShippingAddresses(): Promise<ShippingAddress[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("shipping_addresses")
    .select(ADDRESS_COLUMNS)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(12)

  if (error) throw new Error(error.message)
  return ((data ?? []) as AddressRow[]).map(mapAddress)
}

/** Normalised comparison key so saving the same address twice is a no-op. */
function addressFingerprint(value: {
  address: string
  city: string
  country: string
  postalCode?: string | null
}): string {
  return [value.address, value.city, value.country, value.postalCode ?? ""]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Saves an address for the current user (first one becomes the default).
 * Silently skips when an identical address already exists.
 */
export async function saveShippingAddress(input: ShippingAddressInput): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const existing = await supabase.from("shipping_addresses").select(ADDRESS_COLUMNS).limit(20)

  if (existing.error) throw new Error(existing.error.message)

  const rows = (existing.data ?? []) as AddressRow[]
  const fingerprint = addressFingerprint(input)
  const duplicated = rows.some((row) => addressFingerprint(mapAddress(row)) === fingerprint)
  if (duplicated) return

  const { error } = await supabase.from("shipping_addresses").insert({
    user_id: user.id,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    address: input.address,
    city: input.city,
    country: input.country,
    postal_code: input.postalCode || null,
    // Exactly one default: the first saved address owns it.
    is_default: rows.length === 0,
  })

  if (error) throw new Error(error.message)
}

/** The user's cart rows from the DB (empty list when signed out / no rows). */
export async function fetchRemoteCart(): Promise<CartLine[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return []

  const { data, error } = await supabase.from("shop_cart_items").select("product_id, quantity")
  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<{ product_id: string; quantity: number }>).map((row) => ({
    productId: String(row.product_id),
    quantity: row.quantity,
  }))
}

/**
 * Mirrors the whole local cart into the DB: lines missing locally are
 * deleted, the rest are upserted. Lines whose product no longer exists in
 * the catalog are dropped first, so the `products` FK can never reject the
 * batch.
 */
export async function saveRemoteCart(lines: CartLine[]): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  if (lines.length === 0) {
    const { error } = await supabase.from("shop_cart_items").delete().eq("user_id", user.id)
    if (error) throw new Error(error.message)
    return
  }

  const ids = lines.map((line) => line.productId)

  const catalog = await supabase.from("products").select("id").in("id", ids)
  if (catalog.error) throw new Error(catalog.error.message)
  const validIds = new Set((catalog.data ?? []).map((row) => String((row as { id: unknown }).id)))
  const validLines = lines.filter((line) => validIds.has(line.productId))

  const { error: deleteError } = await supabase
    .from("shop_cart_items")
    .delete()
    .eq("user_id", user.id)
    .not("product_id", "in", `(${ids.join(",")})`)
  if (deleteError) throw new Error(deleteError.message)

  if (validLines.length === 0) return

  const { error: upsertError } = await supabase.from("shop_cart_items").upsert(
    validLines.map((line) => ({
      user_id: user.id,
      product_id: line.productId,
      quantity: line.quantity,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,product_id" },
  )
  if (upsertError) throw new Error(upsertError.message)
}
