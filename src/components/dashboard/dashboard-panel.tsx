"use client"

import { useTranslation } from "react-i18next"

import { AccountView } from "@/components/dashboard/account-view"
import { AppointmentsSection } from "@/components/dashboard/appointments-section"
import { CustomerFavoritesPreview } from "@/components/dashboard/customer-favorites-preview"
import { CustomerOverview } from "@/components/dashboard/customer-overview"
import { DashboardShell, type DashboardRenderContext } from "@/components/dashboard/dashboard-shell"
import { PaymentMethodsSection } from "@/components/dashboard/payment-methods-section"
import { ProfessionalOverview } from "@/components/dashboard/professional-overview"
import { ProviderAppointmentsSection } from "@/components/dashboard/provider-appointments-section"
import { ProviderCardSection } from "@/components/dashboard/provider-card-section"
import { ProviderEarningsSection } from "@/components/dashboard/provider-earnings-section"
import { ProviderPortfolioSection } from "@/components/dashboard/provider-portfolio-section"
import { ProviderVerificationSection } from "@/components/dashboard/provider-verification-section"
import { ScheduleView } from "@/components/dashboard/schedule-view"
import { ViewHeading } from "@/components/dashboard/view-primitives"
import { VenueManagement } from "@/components/dashboard/venue-management"

/**
 * `/dashboard` for both roles. The shell owns the rail and the `?view=`
 * routing; this file only maps a view id to the section that answers it, so
 * adding a destination is one entry in `dashboard-nav` plus one branch below.
 */
export function DashboardPanel() {
  return (
    <DashboardShell>
      {(ctx) =>
        ctx.user.role === "professional" ? (
          <ProfessionalViews {...ctx} />
        ) : (
          <CustomerViews {...ctx} />
        )
      }
    </DashboardShell>
  )
}

function CustomerViews({ view, user, selectView }: DashboardRenderContext) {
  const { t } = useTranslation()

  switch (view) {
    case "appointments":
      return (
        <div className="space-y-8">
          <ViewHeading
            eyebrow={t("dashboard.customer.role")}
            title={t("dashboard.customer.appointmentsViewTitle")}
            body={t("dashboard.customer.appointmentsViewBody")}
          />
          <AppointmentsSection />
        </div>
      )
    case "favorites":
      return <CustomerFavoritesPreview standalone />
    case "payments":
      return <PaymentMethodsSection />
    case "profile":
      return <AccountView user={user} />
    default:
      return <CustomerOverview onNavigate={selectView} />
  }
}

function ProfessionalViews({ view, user, selectView }: DashboardRenderContext) {
  const { t } = useTranslation()

  switch (view) {
    case "appointments":
      return (
        <div className="space-y-8">
          <ViewHeading
            eyebrow={t("dashboard.professional.console")}
            title={t("dashboard.professional.appointments.viewTitle")}
            body={t("dashboard.professional.appointments.viewBody")}
          />
          <ProviderAppointmentsSection />
        </div>
      )
    case "schedule":
      return <ScheduleView />
    case "venues":
      return <VenueManagement user={user} />
    case "earnings":
      return <ProviderEarningsSection />
    case "portfolio":
      return <ProviderPortfolioSection />
    case "account":
      return (
        <AccountView user={user}>
          <ProviderVerificationSection />
          <ProviderCardSection />
        </AccountView>
      )
    default:
      return <ProfessionalOverview onNavigate={selectView} />
  }
}
