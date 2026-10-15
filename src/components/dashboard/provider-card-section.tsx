"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  getProviderCard,
  manageProviderCard,
  requestProviderCard,
  type ProviderCardPayload,
} from "@/services/payments.service"
import { toIntlLocale } from "@/utils/format"

/**
 * GDN virtual card for the professional (Stripe Issuing): request it, check
 * the balance and recent authorizations (`issuing-authorization` approves
 * each charge against the connected account's balance).
 */
export function ProviderCardSection() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const supabase = getSupabaseBrowserClient()
  const [data, setData] = useState<ProviderCardPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function reload() {
    try {
      setData(await getProviderCard())
    } catch (error) {
      setMessage((error as Error).message || t("common.tryAgain"))
    }
  }

  useEffect(() => {
    if (!supabase) return
    let active = true
    getProviderCard()
      .then((value) => {
        if (active) setData(value)
      })
      .catch((error: Error) => {
        if (active) setMessage(error.message || t("common.tryAgain"))
      })
    return () => {
      active = false
    }
  }, [supabase])

  if (!supabase) return null

  async function handleRequest() {
    setBusy(true)
    setMessage(null)
    try {
      await requestProviderCard()
      toast(t("dashboard.professional.gdnCard.requested"))
      await reload()
    } catch (error) {
      setMessage((error as Error).message || t("common.tryAgain"))
    } finally {
      setBusy(false)
    }
  }

  async function handleManage(action: "block" | "unblock" | "report_lost") {
    setBusy(true)
    setMessage(null)
    try {
      await manageProviderCard(action)
      toast(t("dashboard.professional.gdnCard.updated"))
      await reload()
    } catch (error) {
      setMessage((error as Error).message || t("common.tryAgain"))
    } finally {
      setBusy(false)
    }
  }

  const money = (value: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(value)
    } catch {
      return `$${value.toFixed(2)}`
    }
  }

  return (
    <section className="border-cream/10 bg-ink-card rounded-4xl border p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">
          {t("dashboard.professional.gdnCard.title")}
        </h2>
        <p className="text-cream/50 mt-1 text-sm">{t("dashboard.professional.gdnCard.body")}</p>
      </div>

      {data === null ? (
        <div className="bg-cream/5 mt-5 h-32 animate-pulse rounded-2xl" />
      ) : !data.hasCard ? (
        <>
          <div className="border-cream/10 mt-5 flex flex-col items-start gap-4 rounded-3xl border border-dashed px-6 py-8">
            <Icon name="credit-card" className="text-cream/25 size-7" />
            <p className="text-cream/55 text-sm">{t("dashboard.professional.gdnCard.empty")}</p>
            <Button size="sm" loading={busy} onClick={() => void handleRequest()}>
              {t("dashboard.professional.gdnCard.request")}
            </Button>
          </div>
          {message && (
            <Alert tone="error" className="mt-4">
              {message}
            </Alert>
          )}
        </>
      ) : (
        <>
          {/* Card visual */}
          <div className="border-gold/25 bg-gold/5 mt-5 flex flex-col justify-between gap-6 rounded-3xl border p-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-gold/80 text-xs tracking-[0.2em] uppercase">GDN Style</p>
              <p className="font-display mt-3 text-xl tracking-[0.25em]">
                •••• •••• •••• {data.card?.last4 ?? "····"}
              </p>
              <p className="text-cream/60 mt-3 text-xs uppercase">
                {data.card?.cardholder_name} ·{" "}
                {data.card
                  ? `${String(data.card.exp_month).padStart(2, "0")}/${data.card.exp_year}`
                  : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-cream/50 text-xs">{t("dashboard.professional.gdnCard.balance")}</p>
              <p className="text-gold text-2xl font-semibold">
                {data.balance != null ? money(data.balance) : "—"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(data.card?.status === "active" || data.cardStatus === "active") && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void handleManage("block")}
              >
                {t("dashboard.professional.gdnCard.block")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void handleManage("unblock")}
            >
              {t("dashboard.professional.gdnCard.unblock")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void handleManage("report_lost")}
              iconLeft={<Icon name="alert" className="size-4" />}
            >
              {t("dashboard.professional.gdnCard.reportLost")}
            </Button>
          </div>

          {message && (
            <Alert tone="error" className="mt-4">
              {message}
            </Alert>
          )}

          {data.transactions.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-base font-semibold">
                {t("dashboard.professional.gdnCard.transactions")}
              </h3>
              <ul className="mt-3 space-y-2">
                {data.transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="border-cream/10 bg-cream/2 flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="text-cream/85 block truncate">{tx.merchant_name}</span>
                      <span className="text-cream/50 text-xs">
                        {new Date(tx.created * 1000).toLocaleString(locale, {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                    <span className="text-cream/85 font-semibold">−{money(tx.amount_dollars)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
