"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { useFavorites } from "@/hooks/use-favorites"
import { useSession } from "@/libs/session"
import { cn } from "@/utils/cn"

interface FavoriteButtonProps {
  venueId: string
  /** `icon` floats over a card cover; `inline` is a labelled button. */
  variant?: "icon" | "inline"
  className?: string
}

/** Heart toggle saved to the account (`favorites` table), gated by the session. */
export function FavoriteButton({ venueId, variant = "icon", className }: FavoriteButtonProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const { authenticated, user } = useSession()
  const { isFavorite, toggle } = useFavorites()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const active = isFavorite(venueId)
  const label = t(active ? "favorites.remove" : "favorites.add")

  // Professionals manage venues; favorites are a client-only feature.
  if (user?.role === "professional") return null

  function handleToggle() {
    // Saving favorites implies a database write, so it always needs a session.
    if (!authenticated) {
      toast(t("favorites.loginRequired"), "neutral")
      router.push(`/auth/login?next=${encodeURIComponent(pathname || "/venues")}`)
      return
    }

    if (active) {
      setConfirmOpen(true)
      return
    }

    toggle(venueId)
    toast(t("favorites.added"))
  }

  function handleConfirmRemove() {
    toggle(venueId)
    setConfirmOpen(false)
    toast(t("favorites.removed"))
  }

  const dialog = (
    <ConfirmDialog
      open={confirmOpen}
      title={t("favorites.removeConfirmTitle")}
      body={t("favorites.removeConfirmBody")}
      confirmLabel={t("favorites.removeConfirm")}
      tone="danger"
      onConfirm={handleConfirmRemove}
      onClose={() => setConfirmOpen(false)}
    />
  )

  if (variant === "inline") {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleToggle}
          aria-pressed={active}
          aria-label={label}
        >
          <Icon name="heart" className={cn("size-4", active && "fill-gold text-gold")} />
          {label}
        </Button>
        {dialog}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={active}
        aria-label={label}
        className={cn(
          "bg-ink/70 border-cream/15 hover:border-gold/50 inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition",
          className,
        )}
      >
        <Icon
          name="heart"
          className={cn("size-4 transition", active ? "fill-gold text-gold" : "text-cream/70")}
        />
      </button>
      {dialog}
    </>
  )
}
