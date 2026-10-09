"use client"

import { useTranslation } from "react-i18next"

/** Keyboard skip link, translated on the client. */
export function SkipLink() {
  const { t } = useTranslation()

  return (
    <a
      href="#main"
      className="focus:bg-gold focus:text-gold-ink sr-only z-100 focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:rounded-full focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold"
    >
      {t("common.skipToContent")}
    </a>
  )
}
