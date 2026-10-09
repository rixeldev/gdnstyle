"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { LanguageSwitcher } from "@/components/ui/language-switcher"
import { Logo } from "@/components/ui/logo"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { Icon, type IconProps } from "@/components/ui/icon"
import type { Profile } from "@/interfaces/auth"
import { isSupabaseConfigured } from "@/libs/supabase/env"
import { fetchProfile, signOut } from "@/services/auth.service"
import { useAuth } from "@/hooks/use-auth"

interface Module {
  key: string
  titleKey: string
  bodyKey: string
  icon: IconProps["name"]
}

const customerModules: Module[] = [
  {
    key: "appointments",
    titleKey: "dashboard.customer.appointments",
    bodyKey: "dashboard.customer.appointmentsBody",
    icon: "calendar",
  },
  {
    key: "favorites",
    titleKey: "dashboard.customer.favorites",
    bodyKey: "dashboard.customer.favoritesBody",
    icon: "star",
  },
  {
    key: "history",
    titleKey: "dashboard.customer.history",
    bodyKey: "dashboard.customer.historyBody",
    icon: "clock",
  },
]

const professionalModules: Module[] = [
  {
    key: "agenda",
    titleKey: "dashboard.professional.agenda",
    bodyKey: "dashboard.professional.agendaBody",
    icon: "calendar",
  },
  {
    key: "services",
    titleKey: "dashboard.professional.services",
    bodyKey: "dashboard.professional.servicesBody",
    icon: "list",
  },
  {
    key: "portfolio",
    titleKey: "dashboard.professional.portfolio",
    bodyKey: "dashboard.professional.portfolioBody",
    icon: "images",
  },
  {
    key: "wallet",
    titleKey: "dashboard.professional.wallet",
    bodyKey: "dashboard.professional.walletBody",
    icon: "wallet",
  },
]

function displayName(userName?: string): string {
  if (!userName) return ""
  return userName.split(" ").filter(Boolean).slice(0, 2).join(" ")
}

export function DashboardPanel() {
  const { t } = useTranslation()
  const router = useRouter()
  const { session, user, loading, configured } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    let active = true
    void fetchProfile(session.user.id).then((result) => {
      if (active) setProfile(result)
    })
    return () => {
      active = false
    }
  }, [session?.user])

  // No session: redirect to the customer entry and let the login form decide.
  useEffect(() => {
    if (!loading && configured && !session) {
      router.replace("/auth/login?role=customer")
    }
  }, [loading, configured, session, router])

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    router.replace("/auth/login?role=customer")
    router.refresh()
  }

  let content

  if (!configured) {
    content = (
      <div className="space-y-5">
        <Alert tone="info">
          <span className="font-semibold">{t("auth.unavailable.title")}</span>
          <br />
          {t("auth.unavailable.body")}
        </Alert>
        <Link
          href="/"
          className="text-gold inline-block text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("common.backHome")}
        </Link>
      </div>
    )
  } else if (loading || (!session && !loading)) {
    content = (
      <div className="text-cream/50 flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  } else if (session) {
    const role = profile?.role ?? "customer"
    const modules = role === "professional" ? professionalModules : customerModules
    const firstName =
      displayName(profile?.fullName ?? (user?.user_metadata?.full_name as string | undefined)) || ""

    content = (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cream/55 text-sm">{t("dashboard.title")}</p>
            <h1 className="font-display mt-1 text-3xl font-semibold md:text-4xl">
              {firstName ? t("dashboard.greeting", { name: firstName }) : t("dashboard.title")}
            </h1>
            <p className="border-gold/30 bg-gold/10 text-gold-soft mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <Icon name="badge-check" className="h-3.5 w-3.5" />
              {role === "professional"
                ? t("dashboard.professional.role")
                : t("dashboard.customer.role")}
            </p>
            <p className="text-cream/55 mt-3 max-w-md text-sm">
              {role === "professional"
                ? t("dashboard.professional.subtitle")
                : t("dashboard.customer.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="outline" onClick={handleSignOut} loading={signingOut}>
              {signingOut ? t("dashboard.signingOut") : t("dashboard.signOut")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <div
              key={module.key}
              className="border-cream/10 bg-ink-card hover:border-gold/40 rounded-3xl border p-6 transition duration-300 hover:-translate-y-1"
            >
              <Icon name={module.icon} className="text-gold h-6 w-6" />
              <h2 className="font-display mt-4 text-xl">{t(module.titleKey)}</h2>
              <p className="text-cream/55 mt-2 text-sm leading-relaxed">{t(module.bodyKey)}</p>
              <span className="text-cream/30 mt-4 inline-flex items-center gap-1.5 text-xs tracking-[0.16em] uppercase">
                {t("common.soon")}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grain bg-ink text-cream relative min-h-dvh overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(224,176,68,0.12),transparent_44%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(55,10,91,0.4),transparent_55%)]"
      />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="rounded-lg">
          <Logo />
        </Link>
      </header>
      <main id="main" className="relative mx-auto max-w-6xl px-5 pb-16 md:px-8">
        {content}
      </main>
    </div>
  )
}
