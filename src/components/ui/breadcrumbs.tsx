import Link from "next/link"

import { cn } from "@/utils/cn"

export interface Crumb {
  label: string
  href?: string
}

/** Accessible breadcrumb trail used by the directory and venue pages. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-cream/45 text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="hover:text-gold underline-offset-4 transition hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-cream/70" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" className="text-cream/25">
                  /
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
