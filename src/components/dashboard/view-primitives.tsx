import type { ReactNode } from "react"

import { cn } from "@/utils/cn"

/**
 * Shared chrome for the dashboard views. Both roles use the same primitives so
 * the two layouts differ in density and accent, not in component vocabulary.
 */

interface ViewHeadingProps {
  /** Small gold kicker above the title; the role speaking first. */
  eyebrow?: string
  title: string
  body?: string
  actions?: ReactNode
  className?: string
}

export function ViewHeading({ eyebrow, title, body, actions, className }: ViewHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-gold text-[11px] font-semibold tracking-[0.22em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display mt-1.5 text-3xl leading-tight font-semibold md:text-4xl">
          {title}
        </h1>
        {body && <p className="text-cream/55 mt-2 max-w-2xl text-sm leading-relaxed">{body}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

interface PanelProps {
  className?: string
  children: ReactNode
}

/** A card surface. The professional views pack them tighter than the client's. */
export function Panel({ className, children }: PanelProps) {
  return (
    <section
      className={cn("border-cream/10 bg-ink-card/70 rounded-3xl border p-5 md:p-6", className)}
    >
      {children}
    </section>
  )
}

interface PanelHeadProps {
  title: string
  body?: string
  action?: ReactNode
  className?: string
}

export function PanelHead({ title, body, action, className }: PanelHeadProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold md:text-xl">{title}</h2>
        {body && <p className="text-cream/50 mt-1 text-sm leading-relaxed">{body}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

interface EmptyStateProps {
  icon: ReactNode
  title: string
  body?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-cream/10 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <span className="text-cream/25">{icon}</span>
      <p className="font-display text-base font-semibold">{title}</p>
      {body && <p className="text-cream/50 max-w-md text-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

interface StatTileProps {
  icon: ReactNode
  /** `null` while the number is still loading. */
  value: ReactNode
  label: string
  hint?: string
  /** Gold reads warm (client), the indigo accent reads operational (pro). */
  tone?: "gold" | "cool"
  /** Console numerals: aligned columns when several tiles sit in a row. */
  numeric?: boolean
  className?: string
}

export function StatTile({
  icon,
  value,
  label,
  hint,
  tone = "gold",
  numeric = true,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "border-cream/10 bg-ink-card/70 flex items-start gap-3.5 rounded-2xl border p-4",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl border",
          tone === "gold"
            ? "border-gold/25 bg-gold/10 text-gold"
            : "border-royal bg-royal/50 text-cream",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "font-display text-2xl leading-none font-semibold",
            numeric && "tabular-nums",
          )}
        >
          {value}
        </p>
        <p className="text-cream/55 mt-1.5 truncate text-xs">{label}</p>
        {hint && <p className="text-cream/35 mt-0.5 truncate text-[11px]">{hint}</p>}
      </div>
    </div>
  )
}
