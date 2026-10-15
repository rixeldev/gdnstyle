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

/**
 * `HH:MM` clock text (Postgres `time`, `<input type="time">` value) rendered
 * the way the app shows time everywhere else -- locale-aware, so the US default
 * reads "3:00 PM" instead of the 15:00 the database stores. The string is only
 * ever read: the stored value and the native input keep their 24h form, which
 * is what saves parse and round-tripping. Returns the input untouched when it
 * is not a real time rather than letting `Intl` throw on an invalid date.
 */
export function formatClockTime(value: string, locale: string): string {
  const [rawHours, rawMinutes] = value.split(":")
  const hours = Number(rawHours)
  const minutes = Number(rawMinutes)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return value
  return formatTime(new Date(2000, 0, 1, hours, minutes), locale)
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
