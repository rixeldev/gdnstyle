import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

/**
 * Fixed-window counters for the Edge Functions whose calls cost real money:
 * Stripe API calls, outbound email, payment intents.
 *
 * Backed by `consume_rate_limit` (migration 0008), which only the service role
 * may execute — the key is built here, from an identity the calling function
 * already verified, so a client can never spend somebody else's budget.
 *
 * Everything here fails open on purpose. When the migration has not been
 * applied yet, or the database blips, the request goes through: refusing to
 * take a payment is a worse outcome than a short burst of calls. The failure
 * is logged so it does not stay invisible.
 */
export async function underRateLimit(
  supabase: SupabaseClient,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.warn(`[rate-limit] ${error.message} — continuing without a limit for ${key}`)
      return true
    }

    return data !== false
  } catch (cause) {
    console.warn(`[rate-limit] ${String(cause)} — continuing without a limit for ${key}`)
    return true
  }
}
