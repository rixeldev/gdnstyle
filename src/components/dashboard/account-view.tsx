"use client"

import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { ViewHeading } from "@/components/dashboard/view-primitives"
import { ProfileDialog } from "@/components/dashboard/profile-dialog"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import type { SessionUser } from "@/libs/session"
import { initials } from "@/utils/initials"

interface AccountViewProps {
  user: SessionUser
  /** Role-specific blocks rendered under the profile card. */
  children?: ReactNode
}

/** One-line summary of the account address, `null` when nothing is on file. */
function accountAddressLine(user: SessionUser): string | null {
  const { line1, line2, city, state, postalCode } = user.address
  const street = [line1, line2].filter(Boolean).join(", ")
  const locality = [city, [state, postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")
  // The country is the same everywhere in this marketplace, so it stays out.
  const line = [street, locality].filter(Boolean).join(" · ")
  return line || null
}

/**
 * Identity card plus whatever the role needs to configure. The card summarises
 * what the dialog edits — contact details, where the account is and the short
 * bio — so nothing in there is a surprise after saving.
 */
export function AccountView({ user, children }: AccountViewProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)

  const rows = [
    { key: "email", icon: "mail" as const, label: t("dashboard.account.email"), value: user.email },
    {
      key: "phone",
      icon: "phone" as const,
      label: t("dashboard.account.phone"),
      value: user.phone,
    },
    {
      key: "address",
      icon: "map-pin" as const,
      label: t("dashboard.account.addressLabel"),
      value: accountAddressLine(user),
    },
  ].filter((row) => row.value)

  return (
    <div className="space-y-6">
      <ViewHeading
        eyebrow={t("dashboard.nav.account")}
        title={t("dashboard.account.title")}
        body={t("dashboard.account.subtitle")}
        actions={
          <Button
            onClick={() => setEditing(true)}
            iconLeft={<Icon name="sliders" className="size-4" />}
          >
            {t("dashboard.account.editTitle")}
          </Button>
        }
      />

      <section className="border-cream/10 bg-ink-card/70 flex flex-wrap items-start gap-5 rounded-3xl border p-5 md:p-6">
        <span className="from-gold/30 to-royal/40 text-gold font-display flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-semibold">
          {initials(user.fullName ?? user.email ?? "")}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-2xl font-semibold">
            {user.fullName ?? t("dashboard.professional.role")}
          </h2>
          <p className="border-gold/30 bg-gold/10 text-gold-soft mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <Icon name="badge-check" className="size-3.5" />
            {user.role === "professional"
              ? t("dashboard.professional.role")
              : t("dashboard.customer.role")}
          </p>

          {rows.length > 0 && (
            <dl className="text-cream/60 mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <Icon name={row.icon} className="text-gold size-4" />
                  <dt className="text-cream/40">{row.label}</dt>
                  <dd className="font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <p className="text-cream/60 mt-4 max-w-2xl text-sm leading-relaxed">
            {user.bio ?? t("dashboard.professional.noBio")}
          </p>
        </div>
      </section>

      {children}

      {editing && <ProfileDialog open user={user} onClose={() => setEditing(false)} />}
    </div>
  )
}
