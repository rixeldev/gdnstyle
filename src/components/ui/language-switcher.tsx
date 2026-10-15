"use client"

import { useTranslation } from "react-i18next"

import { useLocale } from "@/components/providers/i18n-provider"
import { LOCALE_LABELS } from "@/libs/i18n/settings"
import { cn } from "@/utils/cn"

import { Icon } from "./icon"
import { Select } from "./select"

/** Accessible language selector that switches instantly and persists. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { locale, setLocale, locales } = useLocale()

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <Icon name="globe" className="text-cream/50 pointer-events-none size-4" />
      <span className="visually-hidden">{t("common.changeLanguage")}</span>
      <Select
        value={locale}
        options={locales.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}
        onChange={(value) => setLocale(value as (typeof locales)[number])}
        ariaLabel={t("common.changeLanguage")}
        variant="ghost"
        align="right"
        triggerClassName="pl-1.5 text-sm"
      />
    </div>
  )
}
