import Image from "next/image"

import { cn } from "@/utils/cn"

interface LogoProps {
  className?: string
  /** Wordmark size. */
  size?: "sm" | "md"
  /** Hide the wordmark and show only the mark. */
  markOnly?: boolean
}

export function Logo({ className, size = "md", markOnly = false }: LogoProps) {
  const markSize = size === "sm" ? 32 : 36

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/icono.png"
        alt=""
        width={markSize}
        height={markSize}
        className="object-contain"
        priority
      />
      {!markOnly && (
        <span
          className={cn(
            "font-display text-cream font-semibold tracking-[0.14em]",
            size === "sm" ? "text-xs" : "text-[0.95rem]",
          )}
        >
          GDN STYLE
        </span>
      )}
    </span>
  )
}
