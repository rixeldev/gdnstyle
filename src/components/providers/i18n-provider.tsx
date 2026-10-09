"use client"

import { useEffect, useMemo } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"

import { createI18n } from "@/libs/i18n/client"
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, type Locale } from "@/libs/i18n/settings"

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_STORAGE_KEY}=([^;]*)`))
  if (!match) return null
  const value = decodeURIComponent(match[1])
  return isLocale(value) ? value : null
}

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE

  const cookieLocale = readCookieLocale()
  if (cookieLocale) return cookieLocale

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    /* localStorage can be unavailable (private mode); fall back to default. */
  }

  return DEFAULT_LOCALE
}

function readBootLocale(): Locale {
  // During hydration the client must agree with the DOM the server sent:
  // adopt its `lang` attribute instead of guessing from storage.
  if (typeof document === "undefined") return DEFAULT_LOCALE
  const docLang = document.documentElement.getAttribute("lang")
  return isLocale(docLang) ? docLang : DEFAULT_LOCALE
}

/** Persist a locale in both a cookie (for the server) and localStorage. */
export function persistLocale(locale: Locale) {
  if (typeof document === "undefined") return
  document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore storage failures */
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Always boot in the language of the served document (`<html lang>`), so the
  // very first client render matches the server HTML byte-for-byte; the stored
  // preference is applied afterwards, in an effect, never during hydration.
  const i18n = useMemo(() => createI18n(readBootLocale()), [])

  useEffect(() => {
    const stored = readStoredLocale()
    if (stored !== i18n.language) {
      void i18n.changeLanguage(stored)
    }

    const syncDocumentLang = (lng: string) => {
      document.documentElement.lang = lng
    }

    syncDocumentLang(i18n.language)
    i18n.on("languageChanged", syncDocumentLang)

    return () => {
      i18n.off("languageChanged", syncDocumentLang)
    }
  }, [i18n])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

/** Small hook to read/switch the active locale with persistence. */
export function useLocale() {
  const { i18n } = useTranslation()
  const current = (isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE) as Locale

  const setLocale = (locale: Locale) => {
    persistLocale(locale)
    void i18n.changeLanguage(locale)
  }

  return { locale: current, setLocale, locales: ["es", "en"] as const }
}
