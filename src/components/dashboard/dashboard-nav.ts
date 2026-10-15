import type { IconName } from "@/interfaces/common"
import type { UserRole } from "@/interfaces/auth"

/** One destination in the dashboard rail. */
export interface NavItem {
  /** Matches the `?view=` value that keeps the route shareable across reloads. */
  id: string
  labelKey: string
  icon: IconName
  /**
   * Only offered to a professional whose row exists in `providers`: the section
   * reads Stripe Connect data keyed by that id, so without it there is nothing
   * to show.
   */
  requiresProvider?: boolean
}

/**
 * The two dashboards share one route but not one information architecture: a
 * client browses (what is next, what is saved), a professional operates (what
 * needs me today, what I sell, what I earned).
 */
export const CUSTOMER_NAV: NavItem[] = [
  { id: "overview", labelKey: "dashboard.nav.overview", icon: "layout-grid" },
  { id: "appointments", labelKey: "dashboard.nav.appointments", icon: "calendar" },
  { id: "favorites", labelKey: "dashboard.nav.favorites", icon: "heart" },
  { id: "payments", labelKey: "dashboard.nav.payments", icon: "credit-card" },
  { id: "profile", labelKey: "dashboard.nav.profile", icon: "user" },
]

export const PROFESSIONAL_NAV: NavItem[] = [
  { id: "overview", labelKey: "dashboard.nav.overview", icon: "layout-grid" },
  { id: "appointments", labelKey: "dashboard.nav.appointments", icon: "inbox" },
  { id: "schedule", labelKey: "dashboard.nav.schedule", icon: "clock", requiresProvider: true },
  { id: "venues", labelKey: "dashboard.nav.venues", icon: "store" },
  {
    id: "earnings",
    labelKey: "dashboard.nav.earnings",
    icon: "trending-up",
    requiresProvider: true,
  },
  { id: "portfolio", labelKey: "dashboard.nav.portfolio", icon: "images", requiresProvider: true },
  { id: "account", labelKey: "dashboard.nav.account", icon: "user" },
]

export function navFor(role: UserRole): NavItem[] {
  return role === "professional" ? PROFESSIONAL_NAV : CUSTOMER_NAV
}

/** Sections gated on a `providers` row; hidden rather than shown broken. */
export function visibleNavFor(role: UserRole, hasProvider: boolean): NavItem[] {
  return navFor(role).filter((item) => !item.requiresProvider || hasProvider)
}

export const DEFAULT_VIEW = "overview"

/** Unknown or forbidden `?view=` values fall back instead of rendering nothing. */
export function resolveView(
  role: UserRole,
  hasProvider: boolean,
  requested: string | null,
): string {
  const items = visibleNavFor(role, hasProvider)
  if (requested && items.some((item) => item.id === requested)) return requested
  return DEFAULT_VIEW
}
