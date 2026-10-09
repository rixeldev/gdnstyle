import type { Metadata } from "next"

import { TermsPage } from "@/components/legal/terms-page"

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso de GDN Style.",
}

export default function Terms() {
  return <TermsPage />
}
