"use client"

import { useEffect, useState } from "react"

import { useIsClient } from "@/hooks/use-is-client"
import { createId } from "@/libs/storage"
import { cn } from "@/utils/cn"

import { Icon } from "./icon"

export type ToastTone = "success" | "neutral"

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

const TOAST_EVENT = "gdn:toast"
const TOAST_MS = 3600

/**
 * Fire a toast from anywhere (favorites, bookings, reviews…). The `<Toaster />`
 * host renders it; mount one instance per document (see `AppProviders`).
 */
export function toast(message: string, tone: ToastTone = "success") {
  if (typeof window === "undefined") return
  const detail: ToastItem = { id: createId("toast"), message, tone }
  window.dispatchEvent(new CustomEvent<ToastItem>(TOAST_EVENT, { detail }))
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  const mounted = useIsClient()

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastItem>).detail
      setItems((previous) => [...previous.slice(-2), detail])
      window.setTimeout(() => {
        setItems((previous) => previous.filter((item) => item.id !== detail.id))
      }, TOAST_MS)
    }

    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  // Render nothing until after mount so the SSR markup stays empty.
  if (!mounted) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-5"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className="border-gold/30 bg-ink-card/95 shadow-luxe animate-fade-in-up pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-full border px-4 py-3 backdrop-blur-md"
        >
          <Icon
            name={item.tone === "success" ? "check-circle" : "bell"}
            className={cn(
              "size-5 shrink-0",
              item.tone === "success" ? "text-gold" : "text-cream/60",
            )}
          />
          <p className="text-cream/90 text-sm leading-snug">{item.message}</p>
        </div>
      ))}
    </div>
  )
}
