"use client"

import { useTranslation } from "react-i18next"

import { Icon } from "@/components/ui/icon"

const FAQ_KEYS = ["book", "cancel", "pay", "refund", "profile"] as const

export function FaqList() {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      {FAQ_KEYS.map((key) => (
        <details
          key={key}
          className="group border-cream/10 bg-ink-card open:border-gold/40 rounded-2xl border transition"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left">
            <span className="text-cream text-sm font-medium sm:text-base">
              {t(`legal.faq.items.${key}.q`)}
            </span>
            <span className="border-cream/15 text-cream/50 group-open:border-gold/50 group-open:text-gold flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-transform duration-300 group-open:rotate-45">
              <Icon name="close" className="h-3.5 w-3.5" />
            </span>
          </summary>
          <div className="px-5 pb-5">
            <p className="text-cream/60 text-sm leading-relaxed">{t(`legal.faq.items.${key}.a`)}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
