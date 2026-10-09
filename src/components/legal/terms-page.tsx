"use client"

import { useTranslation } from "react-i18next"

import { LegalSections } from "@/components/legal/legal-sections"
import { LegalShell } from "@/components/legal/legal-shell"

export function TermsPage() {
  const { t } = useTranslation()

  return (
    <LegalShell title={t("legal.terms.title")} subtitle={""}>
      <LegalSections baseKey="legal.terms" sectionKeys={["use", "accounts", "payments"]} />
    </LegalShell>
  )
}
