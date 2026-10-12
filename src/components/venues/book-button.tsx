"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, type ButtonSize } from "@/components/ui/button"
import { hasSession } from "@/libs/session"

interface BookButtonProps {
  venueId: string
  size?: ButtonSize
  fullWidth?: boolean
}

/**
 * Booking entry point used on venue cards: opens the venue page, where the
 * booking flow lives. Without an account the visitor signs in first and is
 * returned to the venue afterwards via `next`.
 */
export function BookButton({ venueId, size = "sm", fullWidth = false }: BookButtonProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleBook() {
    if (busy) return
    setBusy(true)
    try {
      const next = `/locales/${encodeURIComponent(venueId)}`
      if (!(await hasSession())) {
        router.push(`/auth/login?next=${encodeURIComponent(next)}`)
        return
      }
      router.push(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      size={size}
      onClick={handleBook}
      loading={busy}
      className={fullWidth ? "w-full" : undefined}
    >
      {t("directory.book")}
    </Button>
  )
}
