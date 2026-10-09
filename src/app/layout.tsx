import type { Metadata, Viewport } from "next"

import { AppProviders } from "@/components/providers/app-providers"
import { SkipLink } from "@/components/ui/skip-link"
import { SITE } from "@/constants/site"
import { cinzel, cormorant, geist } from "@/libs/fonts"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "GDN Style — Reserva belleza cerca de ti",
    template: "%s · GDN Style",
  },
  description:
    "GDN Style es la app para encontrar y reservar profesionales de belleza, bienestar y servicios de cuidado personal. Busca, reserva, paga y valora en un solo lugar.",
  applicationName: SITE.name,
  keywords: [
    "GDN Style",
    "reservar belleza",
    "barbería",
    "maquillaje",
    "depilación",
    "masaje",
    "citas de belleza",
  ],
  authors: [{ name: SITE.name }],
  openGraph: {
    type: "website",
    locale: "es_DO",
    url: SITE.url,
    siteName: SITE.name,
    title: "GDN Style — Reserva belleza cerca de ti",
    description:
      "Encuentra profesionales de belleza, reserva tu cita y paga desde la app. Para quien se cuida y para quien trabaja de ello.",
    images: [{ url: "/icono.png", width: 440, height: 472, alt: "GDN Style" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GDN Style — Reserva belleza cerca de ti",
    description: "Busca, reserva, paga y valora profesionales de belleza en un solo lugar.",
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: "#070707",
  colorScheme: "dark",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geist.variable} ${cinzel.variable} ${cormorant.variable}`}
    >
      <body className="bg-ink text-cream min-h-dvh antialiased">
        <AppProviders>
          <SkipLink />
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
