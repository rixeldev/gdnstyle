import type { Metadata, Viewport } from "next"
import { connection } from "next/server"

import { AppProviders } from "@/components/providers/app-providers"
import { SkipLink } from "@/components/ui/skip-link"
import { SITE } from "@/constants/site"
import { cinzel, cormorant, geist } from "@/libs/fonts"
import { DEFAULT_LOCALE } from "@/libs/i18n/settings"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "GDN Style — Book beauty near you",
    template: "%s · GDN Style",
  },
  description:
    "GDN Style is the app to find and book beauty, wellness and personal care professionals. Search, book, pay and review in one place.",
  applicationName: SITE.name,
  keywords: [
    "GDN Style",
    "book beauty",
    "barbershop",
    "makeup",
    "waxing",
    "massage",
    "beauty appointments",
  ],
  authors: [{ name: SITE.name }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE.url,
    siteName: SITE.name,
    title: "GDN Style — Book beauty near you",
    description:
      "Find beauty professionals, book your appointment and pay from the app. For anyone who takes care of themselves and for anyone who works at it.",
    images: [{ url: "/icono.png", width: 440, height: 472, alt: "GDN Style" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GDN Style — Book beauty near you",
    description: "Search, book, pay and review beauty professionals in one place.",
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: "#070707",
  colorScheme: "dark",
}

/**
 * The nonce CSP makes every route render per request (see `connection()` in
 * this layout), so no page produces a static shell anymore. `instant = false`
 * on the root layout tells Cache Components that is intended — a `false` this
 * high takes precedence for the whole app.
 */
export const instant = false

/**
 * The proxy mints a CSP nonce per request, and Next stamps it on its own
 * scripts only while rendering dynamically — a page prerendered at build time
 * carries inline scripts with no nonce and would be blocked by that very
 * header. Awaiting `connection()` here opts the whole tree out of
 * prerendering, which is the price of a nonce-based CSP; the layout wraps
 * every route, so one call covers them all.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection()

  return (
    <html
      // English is the served language; a visitor who picked another one is
      // switched to it after hydration (see `I18nProvider`), which keeps every
      // route prerenderable instead of reading cookies during the request.
      lang={DEFAULT_LOCALE}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
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
