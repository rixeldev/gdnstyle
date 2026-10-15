/** Locale-aware helpers. The app sells in the US market (en-US / es-US). */

export type DateInput = Date | string | number

export function formatDate(
  value: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long" },
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value))
}

export function formatTime(
  value: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = { timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value))
}

export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

export function formatCurrency(
  value: number,
  locale: string,
  currency = "USD",
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, ...options }).format(value)
}

/** Map an app locale (`es` / `en`) to an Intl locale for the US market. */
export function toIntlLocale(locale: string): string {
  return locale === "es" ? "es-US" : "en-US"
}
