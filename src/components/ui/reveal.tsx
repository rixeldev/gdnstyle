"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { cn } from "@/utils/cn"

interface RevealProps {
  children: React.ReactNode
  className?: string
  /** Stagger delay in milliseconds. */
  delay?: number
}

function subscribeReducedMotion(callback: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Reveals its children with a short fade-up once they enter the viewport.
 * Falls back to instantly visible content (no animation) when the user
 * prefers reduced motion — driven by CSS `motion-reduce` semantics through
 * a media-query subscription rather than a synchronous effect update.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReduced = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  )
  const [observed, setObserved] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReduced) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setObserved(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [prefersReduced])

  const visible = prefersReduced || observed

  return (
    <div
      ref={ref}
      className={cn(
        !visible && "invisible",
        visible && "animate-fade-in-up animate-fill-mode-both",
        className,
      )}
      style={
        prefersReduced ? undefined : visible && delay ? { animationDelay: `${delay}ms` } : undefined
      }
    >
      {children}
    </div>
  )
}
