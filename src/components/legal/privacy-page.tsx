"use client"

import { useTranslation } from "react-i18next"

import { LegalSections } from "@/components/legal/legal-sections"
import { LegalShell } from "@/components/legal/legal-shell"

export function PrivacyPage() {
  const { t } = useTranslation()

  return (
    <LegalShell title={t("legal.privacy.title")} subtitle={""}>
      <LegalSections baseKey="legal.privacy" sectionKeys={["data", "use", "rights"]} />
    </LegalShell>
  )
}
