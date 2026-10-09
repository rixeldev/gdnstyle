"use client"

import { I18nProvider } from "@/components/providers/i18n-provider"

/** Single client boundary that wraps the whole app with global providers. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>
}
