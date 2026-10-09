"use client"

import { useTranslation } from "react-i18next"

import { Alert } from "@/components/ui/alert"

interface LegalSectionsProps {
  /** Base translation key, e.g. "legal.privacy" or "legal.terms". */
  baseKey: "legal.privacy" | "legal.terms"
  sectionKeys: string[]
}

export function LegalSections({ baseKey, sectionKeys }: LegalSectionsProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-8">
      <Alert tone="info">{t(`${baseKey}.placeholderNotice`)}</Alert>

      {sectionKeys.map((key, index) => (
        <section key={key} className="border-cream/10 bg-ink-card rounded-3xl border p-6 sm:p-8">
          <p className="font-display text-gold text-xs">{String(index + 1).padStart(2, "0")}</p>
          <h2 className="font-display mt-2 text-xl font-semibold">
            {t(`${baseKey}.sections.${key}.title`)}
          </h2>
          <p className="text-cream/60 mt-3 text-sm leading-relaxed">
            {t(`${baseKey}.sections.${key}.body`)}
          </p>
        </section>
      ))}
    </div>
  )
}
