"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, type ButtonSize } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { hasSession, useSession } from "@/libs/session"

interface BookButtonProps {
  venueId: string
  size?: ButtonSize
  fullWidth?: boolean
}

/**
 * Booking entry point used on venue cards: opens the venue page, where the
 * booking flow lives. Without an account the visitor signs in first and is
 * returned to the venue afterwards via `next`. Professional accounts never
 * book, so for them the button just opens the venue.
 */
export function BookButton({ venueId, size = "sm", fullWidth = false }: BookButtonProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useSession()
  const [busy, setBusy] = useState(false)
  const professional = user?.role === "professional"
  const href = `/locales/${venueId}`

  async function handleBook() {
    if (busy) return
    if (professional) {
      router.push(href)
      return
    }

    setBusy(true)
    if (!(await hasSession())) {
      router.push(`/auth/login?next=${encodeURIComponent(href)}`)
      setBusy(false)
      return
    }
    router.push(href)
    setBusy(false)
  }

  return (
    <Button
      type="button"
      size={size}
      onClick={handleBook}
      loading={busy}
      className={fullWidth ? "w-full" : undefined}
      iconLeft={professional ? <Icon name="arrow-up-right" className="size-4" /> : undefined}
    >
      {professional ? t("venues.viewVenue") : t("directory.book")}
    </Button>
  )
}
