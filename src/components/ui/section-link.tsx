"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { MouseEvent, ReactNode } from "react"

interface SectionLinkProps {
  href: string
  className?: string
  children: ReactNode
  /** Runs before the scroll, e.g. to close the mobile menu. */
  onNavigate?: () => void
}

/**
 * Anchor link that scrolls from code instead of relying on the URL hash.
 *
 * A plain `href="#seccion"` is ignored by browsers once that hash is already
 * in the address bar, so clicking the same nav item again would do nothing.
 * Here the click is intercepted on the landing page and `scrollIntoView`
 * runs every time (smooth unless the user prefers reduced motion), updating
 * the URL afterwards without triggering a jump. Links to other routes and
 * modified clicks (new tab, etc.) keep their normal `next/link` behavior.
 */
export function SectionLink({ href, className, children, onNavigate }: SectionLinkProps) {
  const pathname = usePathname()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return
    }

    const hashIndex = href.indexOf("#")
    if (hashIndex === -1) return

    const targetPath = href.slice(0, hashIndex) || "/"
    const id = href.slice(hashIndex + 1)
    if (!id || targetPath !== "/" || pathname !== "/") return

    const target = document.getElementById(id)
    if (!target) return

    event.preventDefault()
    onNavigate?.()

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
    window.history.replaceState(null, "", href)
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  )
}
