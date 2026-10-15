"use client"

import { useEffect, useMemo } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"

import { getSharedI18n } from "@/libs/i18n/client"
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LOCALES,
  isLocale,
  type Locale,
} from "@/libs/i18n/settings"

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
  // preference is applied afterwards, never during hydration.
  const i18n = useMemo(() => getSharedI18n(readBootLocale()), [])

  useEffect(() => {
    const syncDocumentLang = (lng: string) => {
      document.documentElement.lang = lng
    }

    syncDocumentLang(i18n.language)
    i18n.on("languageChanged", syncDocumentLang)

    let cancelled = false
    let idleHandle: number | null = null

    const applyStoredLocale = () => {
      if (cancelled) return
      const stored = readStoredLocale()
      if (stored !== i18n.language) {
        void i18n.changeLanguage(stored)
      }
    }

    // Apply the persisted preference only once the document has finished
    // loading and the browser goes idle. With PPR/Suspense, hydration runs in
    // several passes after the first commit; switching the language between
    // passes makes later passes render text that differs from the served HTML
    // (hydration mismatch). Once hydration is done, re-rendering in another
    // language is a normal, safe client update.
    const schedule = () => {
      if (cancelled) return
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(applyStoredLocale, { timeout: 1500 })
      } else {
        idleHandle = window.setTimeout(applyStoredLocale, 120)
      }
    }

    if (document.readyState === "complete") {
      schedule()
    } else {
      window.addEventListener("load", schedule, { once: true })
    }

    return () => {
      cancelled = true
      window.removeEventListener("load", schedule)
      if (idleHandle !== null) {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleHandle)
        } else {
          window.clearTimeout(idleHandle)
        }
      }
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

  return { locale: current, setLocale, locales: LOCALES }
}
