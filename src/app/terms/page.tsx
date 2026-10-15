import type { Metadata } from "next"

import { TermsPage } from "@/components/legal/terms-page"

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "Terms and conditions of use for GDN Style.",
}

export default function Terms() {
  return <TermsPage />
}
