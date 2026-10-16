import { getSharedI18n } from "@/libs/i18n/client"

/**
 * Business failures the Edge Functions report with a machine-readable `code`
 * (see `FunctionFailure` there). Translating them here is what keeps a Spanish
 * sentence written inside a Deno function from reaching an English interface —
 * and what lets the wording change without redeploying anything.
 *
 * Unknown codes return `null` on purpose: the caller falls back to its own
 * generic message instead of leaking whatever the function happened to throw.
 */
const MESSAGE_KEYS: Record<string, string> = {
  DUPLICATE: "functions.codes.duplicate",
  NOT_AUTHENTICATED: "functions.codes.notAuthenticated",
  NO_STRIPE_CUSTOMER: "functions.codes.noStripeCustomer",
  PROVIDER_MISMATCH: "functions.codes.serviceMismatch",
  PROVIDER_NOT_CONFIGURED: "functions.codes.providerNotConfigured",
  PROVIDER_NOT_FOUND: "functions.codes.providerNotConfigured",
  RATE_LIMITED: "functions.codes.rateLimited",
  SERVICE_NOT_FOUND: "functions.codes.serviceNotFound",
  SERVICE_PRICE_MISSING: "functions.codes.servicePriceMissing",
  SERVICE_REQUIRED: "functions.codes.serviceNotFound",
  SLOT_TAKEN: "venues.booking.slotTaken",
}

/** Localized message for a known server code, or `null` when it is unknown. */
export function serverErrorMessage(serverCode: string | null): string | null {
  if (!serverCode) return null
  const key = MESSAGE_KEYS[serverCode]
  return key ? getSharedI18n().t(key) : null
}
