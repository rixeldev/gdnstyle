import { z } from "zod"

import { type TranslateFn } from "./auth"

export type PaymentBrand = "visa" | "mastercard" | "amex" | "discover" | "generic"

/** Brand detection is a display nicety, not a payment-network check. */
export function detectBrand(digits: string): PaymentBrand {
  if (/^4/.test(digits)) return "visa"
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "mastercard"
  if (/^3[47]/.test(digits)) return "amex"
  if (/^6(?:011|5)/.test(digits)) return "discover"
  return "generic"
}

/** Digits per display group: Amex uses 4-6-5, everyone else 4-4-4-4. */
export function cardDigitGroups(brand: PaymentBrand): number[] {
  return brand === "amex" ? [4, 6, 5] : [4, 4, 4, 4]
}

/** Keeps digits only (capped) and groups them per brand: "4242 4242 4242 4242". */
export function formatCardNumber(raw: string, maxDigits = 16): string {
  const digits = raw.replace(/\D/g, "").slice(0, maxDigits)
  const groups = cardDigitGroups(detectBrand(digits))
  const parts: string[] = []
  let cursor = 0
  for (const size of groups) {
    if (cursor >= digits.length) break
    parts.push(digits.slice(cursor, cursor + size))
    cursor += size
  }
  if (cursor < digits.length) parts.push(digits.slice(cursor))
  return parts.join(" ")
}

/**
 * Enforces `MM/AA` while typing: only digits, a month between 01 and 12 and
 * the slash inserted automatically. Anything else is dropped.
 */
export function formatCardExpiry(raw: string): string {
  let digits = raw.replace(/\D/g, "").slice(0, 4)
  // The month can only start with 0 or 1.
  if (digits.length > 0 && digits[0] !== "0" && digits[0] !== "1") return ""
  // "00"–"09" and "13"–"19" are not months: keep the first digit only.
  if (digits.length >= 2) {
    const month = Number(digits.slice(0, 2))
    if (month < 1 || month > 12) digits = digits.slice(0, 1)
  }
  if (digits.length <= 2) return digits.length === 2 ? `${digits}/` : digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

/** Parses `MM/AA` into `{ month, year }` (20YY); `null` when malformed. */
export function parseCardExpiry(expiry: string): { month: number; year: number } | null {
  const match = expiry.trim().match(/^(\d{2})\/(\d{2})$/)
  if (!match) return null
  const month = Number(match[1])
  if (month < 1 || month > 12) return null
  return { month, year: 2000 + Number(match[2]) }
}

/** Luhn checksum: catches single-digit typos without contacting a network. */
export function isLuhnValid(digits: string): boolean {
  if (!/^\d{15,16}$/.test(digits)) return false
  let sum = 0
  for (let index = 0; index < digits.length; index += 1) {
    let value = Number(digits[digits.length - 1 - index])
    if (index % 2 === 1) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
  }
  return sum % 10 === 0
}

/** Furthest plausible expiry: cards are issued for at most a couple decades. */
const MAX_YEARS_AHEAD = 20

export function createPaymentCardSchema(t: TranslateFn) {
  const now = new Date()

  return z.object({
    // A person's name: letters and separators, never digits.
    holder: z
      .string()
      .trim()
      .min(2, t("dashboard.customer.payments.errors.holder"))
      .max(60, t("dashboard.customer.payments.errors.holderMax"))
      .refine((value) => !/\d/.test(value), t("dashboard.customer.payments.errors.holderChars"))
      .refine(
        (value) => /[\p{L}]/u.test(value),
        t("dashboard.customer.payments.errors.holderChars"),
      ),
    // Normalized (digits only) before this schema sees it.
    number: z
      .string()
      .trim()
      .regex(/^\d{15,16}$/, t("dashboard.customer.payments.errors.number"))
      .refine(
        (value) => !/^(\d)\1+$/.test(value),
        t("dashboard.customer.payments.errors.numberLuhn"),
      )
      .refine(isLuhnValid, t("dashboard.customer.payments.errors.numberLuhn")),
    // Strict `MM/AA`: format, real month, sane distance, never in the past.
    expiry: z
      .string()
      .trim()
      .refine(
        (value) => /^\d{2}\/\d{2}$/.test(value),
        t("dashboard.customer.payments.errors.expiryFormat"),
      )
      .refine(
        (value) => parseCardExpiry(value) !== null,
        t("dashboard.customer.payments.errors.expiryMonth"),
      )
      .refine((value) => {
        const parsed = parseCardExpiry(value)
        return parsed !== null && parsed.year <= now.getFullYear() + MAX_YEARS_AHEAD
      }, t("dashboard.customer.payments.errors.expiryTooFar"))
      .refine((value) => {
        const parsed = parseCardExpiry(value)
        if (parsed === null) return false
        const expired =
          parsed.year < now.getFullYear() ||
          (parsed.year === now.getFullYear() && parsed.month < now.getMonth() + 1)
        return !expired
      }, t("dashboard.customer.payments.errors.expiryPast")),
  })
}

export type PaymentCardValues = z.infer<ReturnType<typeof createPaymentCardSchema>>
