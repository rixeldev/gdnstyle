"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"

import { ButtonLink } from "@/components/ui/button"

export function NotFoundContent() {
  const { t } = useTranslation()

  return (
    <div className="bg-ink text-cream relative flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-gold text-sm tracking-[0.28em] uppercase">404</p>
      <h1 className="font-display mt-4 text-4xl font-semibold md:text-6xl">GDN Style</h1>
      <p className="text-cream/60 mt-4 max-w-sm">{t("errors.notFound")}</p>
      <div className="mt-8">
        <ButtonLink href="/">{t("common.backHome")}</ButtonLink>
      </div>
    </div>
  )
}
