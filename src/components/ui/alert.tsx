import type { ReactNode } from "react"

import { cn } from "@/utils/cn"

import { Icon } from "./icon"

type AlertTone = "error" | "success" | "info"

const tones: Record<AlertTone, string> = {
  error: "border-red-400/30 bg-red-500/10 text-red-100",
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  info: "border-gold/30 bg-gold/10 text-gold-soft",
}

const icons: Record<AlertTone, "alert" | "check" | "sparkles"> = {
  error: "alert",
  success: "check",
  info: "sparkles",
}

interface AlertProps {
  tone?: AlertTone
  children: ReactNode
  className?: string
}

export function Alert({ tone = "info", children, className }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        tones[tone],
        className,
      )}
    >
      <Icon name={icons[tone]} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}
