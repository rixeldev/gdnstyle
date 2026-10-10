"use client"

import { useTranslation } from "react-i18next"

import { useLocale } from "@/components/providers/i18n-provider"
import { LOCALE_LABELS } from "@/libs/i18n/settings"
import { cn } from "@/utils/cn"

import { Icon } from "./icon"

/** Accessible language selector that switches instantly and persists. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { locale, setLocale, locales } = useLocale()

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <Icon name="globe" className="text-cream/50 pointer-events-none size-4" />
      <span className="visually-hidden">{t("common.changeLanguage")}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as (typeof locales)[number])}
        aria-label={t("common.changeLanguage")}
        className="text-cream/80 hover:text-cream focus-visible:text-cream cursor-pointer appearance-none bg-transparent py-1 pr-5 pl-1.5 text-sm transition outline-none"
      >
        {locales.map((code) => (
          <option key={code} value={code} className="bg-ink text-cream">
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </div>
  )
}
