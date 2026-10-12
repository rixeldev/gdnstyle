"use client"

import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { useFavorites } from "@/hooks/use-favorites"
import { cn } from "@/utils/cn"

interface FavoriteButtonProps {
  venueId: string
  /** `icon` floats over a card cover; `inline` is a labelled button. */
  variant?: "icon" | "inline"
  className?: string
}

/** Heart toggle persisted locally (see `useFavorites`). */
export function FavoriteButton({ venueId, variant = "icon", className }: FavoriteButtonProps) {
  const { t } = useTranslation()
  const { isFavorite, toggle } = useFavorites()
  const active = isFavorite(venueId)
  const label = t(active ? "favorites.remove" : "favorites.add")

  function handleToggle() {
    const added = toggle(venueId)
    toast(t(added ? "favorites.added" : "favorites.removed"))
  }

  if (variant === "inline") {
    return (
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
    )
  }

  return (
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
  )
}
