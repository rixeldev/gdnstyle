"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, type ButtonSize } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"

interface BookButtonProps {
  venueId: string
  /** On the venue page the session gate resolves in place instead of navigating. */
  venuePage?: boolean
  size?: ButtonSize
  fullWidth?: boolean
}

/** True when a signed-in session exists, or when auth is not wired up yet (test data). */
async function hasSession(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return true
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

/**
 * Booking action gated on the session: without an account the visitor is sent
 * to the sign-in page first (and returned to the venue afterwards via `next`).
 */
export function BookButton({
  venueId,
  venuePage = false,
  size = "sm",
  fullWidth = false,
}: BookButtonProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(false)

  async function handleBook() {
    if (busy) return
    setBusy(true)
    try {
      const next = `/locales/${encodeURIComponent(venueId)}`
      if (!(await hasSession())) {
        router.push(`/auth/login?next=${encodeURIComponent(next)}`)
        return
      }
      if (venuePage) {
        setNotice(true)
        return
      }
      router.push(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        onClick={handleBook}
        loading={busy}
        className={fullWidth ? "w-full" : undefined}
      >
        {t("directory.book")}
      </Button>
      {notice && (
        <p role="status" className="text-cream/60 mt-3 text-sm">
          {t("venues.detail.comingSoon")}
        </p>
      )}
    </>
  )
}
