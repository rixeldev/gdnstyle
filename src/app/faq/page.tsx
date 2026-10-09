import type { Metadata } from "next"

import { FaqPage } from "@/components/legal/faq-page"

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Respuestas sobre reservar y ofrecer servicios en GDN Style.",
}

export default function Faq() {
  return <FaqPage />
}
