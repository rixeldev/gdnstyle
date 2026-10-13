import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * The `favorites` table stores a signed-in user's saved venues: `user_id` is the
 * account id and `product_id` is the location id. It predates the marketplace
 * RLS work, so it is read/written through the anonymous client but always keyed
 * by the session user.
 */

/** The account's saved location ids, oldest first (keeps the save order). */
export async function fetchFavorites(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client
    .from("favorites")
    .select("product_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[favorites] failed to load", error)
    return []
  }

  return (data ?? []).map((row) => (row as { product_id: string }).product_id)
}

/** Save a venue for the account. */
export async function addFavorite(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<boolean> {
  const { error } = await client
    .from("favorites")
    .insert({ user_id: userId, product_id: productId })

  if (error) {
    console.error("[favorites] failed to save", error)
    return false
  }

  return true
}

/** Remove a saved venue for the account. */
export async function removeFavorite(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<boolean> {
  const { error } = await client
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId)

  if (error) {
    console.error("[favorites] failed to remove", error)
    return false
  }

  return true
}
