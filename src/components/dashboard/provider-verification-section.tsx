"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  fetchProviderStripeState,
  startProviderVerification,
  type ProviderStripeState,
} from "@/services/payments.service"

/**
 * Stripe Connect onboarding for the professional: starts the
 * `create-verification-session` flow and shows the checklist the
 * `handle-identity-webhook` keeps up to date. Payments only work once the
 * account can charge.
 */
export function ProviderVerificationSection() {
  const { t } = useTranslation()
  const supabase = getSupabaseBrowserClient()
  const { user } = useSession()
  const [state, setState] = useState<ProviderStripeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !user?.id) return
    let active = true
    fetchProviderStripeState(supabase, user.id).then((value) => {
      if (!active) return
      setState(value)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [supabase, user?.id])

  if (!supabase) return null

  async function handleVerify() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await startProviderVerification(window.location.href)
      if (result.url) window.location.href = result.url
    } catch (error) {
      setMessage((error as Error).message || t("common.tryAgain"))
      toast(t("common.tryAgain"), "neutral")
    } finally {
      setBusy(false)
    }
  }

  const ready = Boolean(state?.chargesEnabled && state?.payoutsEnabled)

  const checklist: { key: string; done: boolean }[] = [
    { key: "onboarding", done: Boolean(state?.onboardingCompleted) },
    { key: "charges", done: Boolean(state?.chargesEnabled) },
    { key: "payouts", done: Boolean(state?.payoutsEnabled) },
    {
      key: "requirements",
      done: Boolean(state) && (state?.requirementsDue.length ?? 0) === 0,
    },
  ]

  return (
    <section className="border-cream/10 bg-ink-card rounded-4xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {t("dashboard.professional.verification.title")}
          </h2>
          <p className="text-cream/50 mt-1 text-sm">
            {t("dashboard.professional.verification.body")}
          </p>
        </div>
        <span
          className={
            ready
              ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300"
              : "border-gold/30 bg-gold/10 text-gold rounded-full border px-3 py-1 text-xs font-medium"
          }
        >
          {t(
            ready
              ? "dashboard.professional.verification.readyBadge"
              : "dashboard.professional.verification.pendingBadge",
          )}
        </span>
      </div>

      {loading ? (
        <div className="bg-cream/5 mt-5 h-20 animate-pulse rounded-2xl" />
      ) : (
        <>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <li
                key={item.key}
                className="border-cream/10 bg-cream/2 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm"
              >
                <Icon
                  name={item.done ? "check-circle" : "clock"}
                  className={item.done ? "size-4 text-emerald-300" : "text-cream/40 size-4"}
                />
                <span className={item.done ? "text-cream/85" : "text-cream/55"}>
                  {t(`dashboard.professional.verification.checklist.${item.key}`)}
                </span>
              </li>
            ))}
          </ul>

          {state && state.requirementsDue.length > 0 && (
            <p className="text-cream/50 mt-3 text-xs leading-relaxed">
              {t("dashboard.professional.verification.requirements", {
                list: state.requirementsDue.join(", "),
              })}
            </p>
          )}

          {message && <Alert tone="error">{message}</Alert>}

          <Button
            className="mt-5"
            loading={busy}
            onClick={() => void handleVerify()}
            iconLeft={<Icon name="shield" className="size-4" />}
          >
            {t(
              ready
                ? "dashboard.professional.verification.manage"
                : "dashboard.professional.verification.cta",
            )}
          </Button>
        </>
      )}
    </section>
  )
}
