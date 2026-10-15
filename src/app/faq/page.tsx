import type { Metadata } from "next"

import { FaqPage } from "@/components/legal/faq-page"

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about booking and offering services on GDN Style.",
}

export default function Faq() {
  return <FaqPage />
}
