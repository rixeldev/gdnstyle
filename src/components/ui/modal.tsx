"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { useIsClient } from "@/hooks/use-is-client"
import { cn } from "@/utils/cn"

interface ModalProps {
  open: boolean
  /** Request the dialog to close (backdrop click, Escape, close button). */
  onClose: () => void
  /** Id of the heading that names the dialog. */
  labelledBy?: string
  children: ReactNode
  className?: string
}

/**
 * Accessible modal built on the native `<dialog>` element. It is portaled to
 * `<body>` and centered by a full-viewport grid (`.gdn-dialog`), because
 * Tailwind's preflight resets the UA `margin: auto` centering and any ancestor
 * containing context would otherwise pin it to a corner. `showModal()` still
 * gives us the top layer (above the Leaflet map), focus trapping, an inert
 * background and Escape handling for free.
 */
export function Modal({ open, onClose, labelledBy, children, className }: ModalProps) {
  const mounted = useIsClient()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      // `showModal` is missing in some test environments; fall back gracefully.
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, mounted])

  // Lock background scrolling while the dialog is open (native modals already
  // hint at this, but we make it explicit and avoid the scrollbar layout shift).
  useEffect(() => {
    if (!mounted || !open) return
    const { overflow, paddingRight } = document.body.style
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = "hidden"
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [open, mounted])

  // Portals need the DOM, so render nothing during SSR/hydration.
  if (!mounted) return null

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      className="gdn-dialog"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // Clicks on the `::backdrop` area target the dialog element itself.
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className={cn("gdn-dialog__card w-full max-w-[28rem]", className)}>{children}</div>
    </dialog>,
    document.body,
  )
}
