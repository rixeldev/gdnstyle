import type { TFunction } from "i18next"

import type { AuthResult } from "@/interfaces/auth"

const CODE_TO_KEY: Record<string, string> = {
  invalid_credentials: "errors.auth.invalidCredentials",
  email_not_confirmed: "errors.auth.emailNotConfirmed",
  user_already_exists: "errors.auth.userExists",
  email_exists: "errors.auth.userExists",
  weak_password: "errors.auth.weakPassword",
  over_request_rate_limit: "errors.auth.rateLimit",
  over_email_send_rate_limit: "errors.auth.rateLimit",
  session_not_found: "errors.auth.sessionExpired",
  refresh_token_not_found: "errors.auth.sessionExpired",
  unavailable: "errors.auth.unavailable",
  demo_disabled: "errors.auth.demoDisabled",
}

function keyFromMessage(message?: string): string | null {
  if (!message) return null
  const normalized = message.toLowerCase()

  if (normalized.includes("invalid login credentials")) return "errors.auth.invalidCredentials"
  if (normalized.includes("email not confirmed")) return "errors.auth.emailNotConfirmed"
  if (normalized.includes("already registered") || normalized.includes("already exists"))
    return "errors.auth.userExists"
  if (normalized.includes("should be at least") || normalized.includes("password should"))
    return "errors.auth.weakPassword"
  if (normalized.includes("rate limit")) return "errors.auth.rateLimit"
  if (normalized.includes("failed to fetch") || normalized.includes("network"))
    return "errors.network"

  return null
}

/**
 * Turn a Supabase error into a localized, non-sensitive user message.
 * Falls back to a generic message so raw provider errors are never shown.
 */
export function translateAuthError(result: AuthResult, t: TFunction): string {
  if (result.ok) return ""

  if (result.errorCode && CODE_TO_KEY[result.errorCode]) {
    return t(CODE_TO_KEY[result.errorCode])
  }

  const fromMessage = keyFromMessage(result.message)
  if (fromMessage) return t(fromMessage)

  return t("errors.auth.unknown")
}
