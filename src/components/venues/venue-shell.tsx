import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { BackToTop } from "@/components/ui/back-to-top"

/**
 * Shared chrome for the directory and venue pages. Deliberately a component,
 * not a route layout: a blocking route (`instant = false`) with its own layout
 * makes the dev server emit a transition placeholder that duplicates the shell
 * and trips hydration. Wrapping per page (like `AuthShell`) keeps dev clean.
 */
export function VenueShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain bg-ink text-cream relative min-h-dvh overflow-x-hidden">
      <SiteHeader ctaKey="nav.signIn" ctaHref="/auth/login" />
      {children}
      <SiteFooter />
      <BackToTop />
    </div>
  )
}
