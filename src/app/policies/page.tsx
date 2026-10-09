import type { Metadata } from "next"

import { PrivacyPage } from "@/components/legal/privacy-page"

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo GDN Style trata tus datos personales.",
}

export default function Policies() {
  return <PrivacyPage />
}
