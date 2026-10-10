"use client"

import { useTranslation } from "react-i18next"

import { Icon } from "@/components/ui/icon"
import { useScrolled } from "@/hooks/use-scrolled"

/** Floating "back to top" button, shown once the visitor has scrolled down. */
export function BackToTop() {
  const { t } = useTranslation()
  const visible = useScrolled(600)

  function handleClick() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })

    // Drop any section hash so the URL matches the top of the page again.
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
  }

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t("common.backToTop")}
      title={t("common.backToTop")}
      className="border-gold/40 bg-ink-card/90 text-gold hover:bg-gold hover:text-gold-ink shadow-luxe motion-safe:animate-fade-in-up animate-duration-fast fixed right-5 bottom-5 z-40 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border backdrop-blur-md transition-colors md:right-8 md:bottom-8"
    >
      <Icon name="arrow-up" className="size-5" />
    </button>
  )
}
