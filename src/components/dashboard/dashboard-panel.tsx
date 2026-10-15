"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { LanguageSwitcher } from "@/components/ui/language-switcher"
import { Logo } from "@/components/ui/logo"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { AppointmentsSection } from "@/components/dashboard/appointments-section"
import { CustomerFavoritesPreview } from "@/components/dashboard/customer-favorites-preview"
import { CustomerSummaryStats } from "@/components/dashboard/customer-summary-stats"
import { PaymentMethodsSection } from "@/components/dashboard/payment-methods-section"
import { ProfessionalWorkspace } from "@/components/dashboard/professional-workspace"
import { ProfileDialog } from "@/components/dashboard/profile-dialog"
import { useSession } from "@/libs/session"
import { signOut } from "@/services/auth.service"

function displayName(userName: string | null): string {
  if (!userName) return ""
  return userName.split(" ").filter(Boolean).slice(0, 2).join(" ")
}

export function DashboardPanel() {
  const { t } = useTranslation()
  const router = useRouter()
  const { ready, user } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  // No session: send the visitor to the entry point, whatever the backend.
  useEffect(() => {
    if (ready && !user) {
      router.replace("/auth/login?role=customer")
    }
  }, [ready, user, router])

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    router.replace(`/auth/login?role=${role}`)
    router.refresh()
  }

  const role = user?.role ?? "customer"
  const firstName = displayName(user?.fullName ?? null)

  const content =
    !ready || !user ? (
      <div className="text-cream/50 flex h-64 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    ) : (
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
            {role === "customer" && (
              <Button
                variant="ghost"
                onClick={() => setProfileOpen(true)}
                iconLeft={<Icon name="sliders" className="size-4" />}
              >
                {t("dashboard.professional.editProfile")}
              </Button>
            )}
            <Button variant="outline" onClick={handleSignOut} loading={signingOut}>
              {signingOut ? t("dashboard.signingOut") : t("dashboard.signOut")}
            </Button>
          </div>
        </div>

        {user.role === "professional" ? (
          <ProfessionalWorkspace user={user} />
        ) : (
          <>
            <CustomerSummaryStats />

            <AppointmentsSection />

            <CustomerFavoritesPreview />

            <PaymentMethodsSection />
          </>
        )}

        <Link
          href="/"
          className="text-gold inline-block text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("common.backHome")}
        </Link>

        {user.role === "customer" && profileOpen && (
          <ProfileDialog open user={user} onClose={() => setProfileOpen(false)} />
        )}
      </div>
    )

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
