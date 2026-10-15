"use client"

import i18next, { type i18n } from "i18next"
import { initReactI18next } from "react-i18next"

import en from "@/locales/en.json"
import es from "@/locales/es.json"

import { DEFAULT_LOCALE, LOCALES, type Locale } from "./settings"

/**
 * Resources are bundled (no async namespace loading) so the very first render
 * is deterministic and matches between server and client.
 */
const resources = {
  es: { translation: es },
  en: { translation: en },
} as const

export function createI18n(locale: Locale = DEFAULT_LOCALE): i18n {
  const instance = i18next.createInstance()

  instance.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...LOCALES],
    defaultNS: "translation",
    ns: ["translation"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    // Deterministic synchronous initialization: language, resources and
    // `isInitialized` are ready before the first render on both server and
    // client, so `t()` can never observe a half-initialized state.
    initAsync: false,
  })

  return instance
}

let shared: i18n | null = null

/**
 * App-wide i18n instance: `I18nProvider` hands it to React and non-React
 * code (e.g. `invokeFunction` when building localized error messages) reads
 * it too, so both always observe the same language. The first call wins —
 * the boot locale on the client, the default locale during SSR (where the
 * document language is never mutated).
 */
export function getSharedI18n(locale: Locale = DEFAULT_LOCALE): i18n {
  if (!shared) shared = createI18n(locale)
  return shared
}
