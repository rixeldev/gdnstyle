"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { LanguageSwitcher } from "@/components/ui/language-switcher"
import { Logo } from "@/components/ui/logo"
import { Icon } from "@/components/ui/icon"
import { Spinner } from "@/components/ui/spinner"
import {
  DEFAULT_VIEW,
  resolveView,
  visibleNavFor,
  type NavItem,
} from "@/components/dashboard/dashboard-nav"
import { type SessionUser, useSession } from "@/libs/session"
import { signOut } from "@/services/auth.service"
import { cn } from "@/utils/cn"
import { initials } from "@/utils/initials"

export interface DashboardRenderContext {
  view: string
  user: SessionUser
  selectView: (id: string) => void
}

interface DashboardShellProps {
  children: (ctx: DashboardRenderContext) => ReactNode
}

interface NavListProps {
  items: NavItem[]
  view: string
  role: SessionUser["role"]
  onSelect: (id: string) => void
  /** `rail` is the desktop column, `drawer` the phone sheet. */
  variant: "rail" | "drawer"
}

/** The role's sections. Kept at module scope so switching never remounts them. */
function NavList({ items, view, role, onSelect, variant }: NavListProps) {
  const { t } = useTranslation()
  const activeClass =
    role === "professional"
      ? "border-gold/35 bg-royal/55 text-cream"
      : "border-gold/25 bg-gold/10 text-gold-soft"

  return (
    <nav aria-label={t("dashboard.menu")} className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.id === view
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors",
              active
                ? cn(activeClass, "border")
                : "text-cream/65 hover:bg-cream/5 hover:text-cream border-transparent",
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="bg-gold absolute top-1/2 -left-3 h-6 w-1 -translate-y-1/2 rounded-full"
              />
            )}
            <Icon name={item.icon} className={cn("size-4.5 shrink-0", active && "text-gold")} />
            <span className="truncate">{t(item.labelKey)}</span>
            {variant === "drawer" && active && <Icon name="check" className="ml-auto size-4" />}
          </button>
        )
      })}
    </nav>
  )
}

interface RailFooterProps {
  user: SessionUser
  role: SessionUser["role"]
  signingOut: boolean
  /** Closes the drawer after a navigation, if one is open. */
  onSignOut: () => void
}

function RailFooter({ user, role, signingOut, onSignOut }: RailFooterProps) {
  const { t } = useTranslation()
  const accountHref =
    role === "professional" ? "/dashboard?view=account" : "/dashboard?view=profile"

  return (
    <div className="border-cream/10 mt-auto space-y-3 border-t pt-4">
      <Link
        href={accountHref}
        className="hover:bg-cream/5 flex items-center gap-3 rounded-xl px-2 py-2 transition"
      >
        <span className="from-gold/30 to-royal/40 text-gold font-display flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-semibold">
          {initials(user.fullName ?? user.email ?? "")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {user.fullName ?? t("dashboard.nav.account")}
          </span>
          <span className="text-cream/45 block truncate text-xs">
            {role === "professional"
              ? t("dashboard.professional.role")
              : t("dashboard.customer.role")}
          </span>
        </span>
      </Link>

      <LanguageSwitcher className="px-2" />

      <button
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        className="text-cream/55 hover:text-cream flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium transition disabled:opacity-55"
      >
        <Icon name="arrow-left" className="size-4" />
        {signingOut ? t("dashboard.signingOut") : t("dashboard.signOut")}
      </button>

      <Link
        href="/"
        className="text-cream/35 hover:text-cream/60 flex items-center gap-3 rounded-xl px-2 py-2 text-xs transition"
      >
        <Icon name="globe" className="size-3.5" />
        {t("common.backHome")}
      </Link>
    </div>
  )
}

/**
 * One route, two dashboards.
 *
 * The rail is shared so the app reads as one product, but everything else
 * changes with the role: the sections, the accent (warm gold for the client,
 * an indigo console tint for the professional) and the backdrop. The active
 * section lives in `?view=`, so a reload or a shared link lands where the
 * sender was looking.
 */
export function DashboardShell({ children }: DashboardShellProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { ready, user } = useSession()

  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement | null>(null)

  // No session: send the visitor to the entry point, whatever the backend.
  useEffect(() => {
    if (ready && !user) {
      router.replace("/auth/login?role=customer")
    }
  }, [ready, user, router])

  const role = user?.role ?? "customer"
  const hasProvider = Boolean(user?.providerId)
  const items = visibleNavFor(role, hasProvider)
  const view = resolveView(role, hasProvider, searchParams.get("view"))

  const selectView = useCallback(
    (id: string) => {
      setMenuOpen(false)
      // The default section keeps the clean URL: `/dashboard` should never
      // carry a redundant query for the view it already opens on.
      router.replace(id === DEFAULT_VIEW ? "/dashboard" : `/dashboard?view=${id}`, {
        scroll: false,
      })
    },
    [router],
  )

  // Escape closes the drawer, and focus lands inside it so the next Tab walks
  // the navigation instead of the page behind it.
  useEffect(() => {
    if (!menuOpen) return
    drawerRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [menuOpen])

  const handleSignOut = useCallback(async () => {
    setSigningOut(true)
    await signOut()
    router.replace(`/auth/login?role=${role}`)
    router.refresh()
  }, [router, role])

  if (!ready || !user) {
    return (
      <div className="grain bg-ink text-cream flex min-h-dvh items-center justify-center">
        <Spinner className="text-gold size-8" />
      </div>
    )
  }

  // No `overflow-x-hidden` on the wrapper: it would turn this element into a
  // scroll container and break the rail's `position: sticky`.
  return (
    <div className="grain bg-ink text-cream relative min-h-dvh">
      {/* Two rooms in one route: a warm bloom for the client, a denser
          blueprint console for the professional. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[60vh]",
          role === "professional" ? "dash-console" : "dash-concierge",
        )}
      />

      <div className="relative flex min-h-dvh">
        <aside className="border-cream/10 bg-ink-soft/70 sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r p-5 backdrop-blur-sm lg:flex">
          <Link href="/" className="inline-flex rounded-lg" aria-label="GDN Style">
            <Logo />
          </Link>
          <p className="text-cream/40 mt-1 pl-1 text-[11px] font-semibold tracking-[0.22em] uppercase">
            {role === "professional"
              ? t("dashboard.professional.role")
              : t("dashboard.customer.role")}
          </p>

          <div className="mt-6">
            <NavList items={items} view={view} role={role} onSelect={selectView} variant="rail" />
          </div>

          <RailFooter user={user} role={role} signingOut={signingOut} onSignOut={handleSignOut} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Compact bar for phones and tablets. */}
          <header className="border-cream/10 bg-ink/70 sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-md lg:hidden">
            <Link href="/" className="inline-flex rounded-lg" aria-label="GDN Style">
              <Logo />
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={t("dashboard.menu")}
                aria-expanded={menuOpen}
                className="border-cream/15 text-cream hover:bg-cream/5 flex size-10 items-center justify-center rounded-xl border transition"
              >
                <Icon name="menu" className="size-5" />
              </button>
            </div>
          </header>

          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 md:px-8 md:py-10">
            {children({ view, user, selectView })}
          </main>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setMenuOpen(false)}
            className="bg-ink/80 absolute inset-0 backdrop-blur-sm"
          />
          <div
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("dashboard.menu")}
            className="border-gold/15 bg-ink-soft shadow-luxe absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r p-5 outline-none"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t("common.close")}
                className="text-cream/60 hover:text-cream hover:bg-cream/5 flex size-10 items-center justify-center rounded-xl transition"
              >
                <Icon name="close" className="size-5" />
              </button>
            </div>

            <p className="text-cream/40 mt-5 pl-1 text-[11px] font-semibold tracking-[0.22em] uppercase">
              {role === "professional"
                ? t("dashboard.professional.role")
                : t("dashboard.customer.role")}
            </p>

            <div className="mt-3 flex-1 overflow-y-auto">
              <NavList
                items={items}
                view={view}
                role={role}
                onSelect={selectView}
                variant="drawer"
              />
            </div>

            <RailFooter user={user} role={role} signingOut={signingOut} onSignOut={handleSignOut} />
          </div>
        </div>
      )}
    </div>
  )
}
