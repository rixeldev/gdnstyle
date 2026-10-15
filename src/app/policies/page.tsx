import type { Metadata } from "next"

import { PrivacyPage } from "@/components/legal/privacy-page"

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How GDN Style handles your personal data.",
}

export default function Policies() {
  return <PrivacyPage />
}
