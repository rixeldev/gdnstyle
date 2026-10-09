"use client"

import { useTranslation } from "react-i18next"

import { FaqList } from "@/components/legal/faq-list"
import { LegalShell } from "@/components/legal/legal-shell"

export function FaqPage() {
  const { t } = useTranslation()

  return (
    <LegalShell title={t("legal.faq.title")} subtitle={t("legal.faq.subtitle")}>
      <FaqList />
    </LegalShell>
  )
}
