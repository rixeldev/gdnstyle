"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"

import { Icon } from "@/components/ui/icon"

export function VerifyEmailNotice() {
  const { t } = useTranslation()

  return (
    <div className="space-y-5 text-center">
      <div className="border-gold/40 bg-gold/10 text-gold mx-auto flex h-12 w-12 items-center justify-center rounded-full border">
        <Icon name="mail" className="size-6" />
      </div>
      <h1 className="font-display text-2xl font-semibold">{t("auth.verify.title")}</h1>
      <p className="text-cream/60 text-sm leading-relaxed">{t("auth.verify.body")}</p>
      <Link
        href="/auth/login?role=customer"
        className="text-gold inline-block text-sm font-semibold underline-offset-4 hover:underline"
      >
        {t("auth.verify.backToLogin")}
      </Link>
    </div>
  )
}
