/** Supported languages, in the order the switcher lists them. */
export const LOCALES = ["en", "es"] as const

export type Locale = (typeof LOCALES)[number]

/** English is the default: it is the language a first-time visitor gets. */
export const DEFAULT_LOCALE: Locale = "en"

/** Cookie + localStorage key used to persist the chosen language. */
export const LOCALE_STORAGE_KEY = "gdn-style.locale"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

export const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  en: "English",
}
