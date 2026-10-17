"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  createBankAccountLink,
  getProviderPayments,
  listBankAccounts,
  processWithdrawal,
  type BankAccountSummary,
  type ProviderPaymentRow,
  type ProviderPaymentsPayload,
} from "@/services/payments.service"
import { formatDate, formatTime, toIntlLocale } from "@/utils/format"

/** Minimum amount accepted by the `process-withdrawal` function. */
const MIN_WITHDRAWAL = 10

/**
 * A payment's instant, in the viewer's locale. The Edge Function also ships
 * `date`/`time` already formatted with a hardcoded `es-ES` clock (15:00, DD/MM),
 * which is neither the app's language nor its 12h day, so they are used only
 * as a fallback when the timestamp itself will not parse.
 */
function paymentStamp({ created_at, date, time }: ProviderPaymentRow, locale: string): string {
  const at = Date.parse(created_at)
  if (!Number.isFinite(at)) return `${date} ${time}`
  return `${formatDate(at, locale, { dateStyle: "medium" })} · ${formatTime(at, locale)}`
}

/**
 * Professional finance hub: earnings from `get-provider-payments`, bank
 * accounts from `manage-bank-accounts` and payouts via `process-withdrawal`.
 */
export function ProviderEarningsSection() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const supabase = getSupabaseBrowserClient()
  const [data, setData] = useState<ProviderPaymentsPayload | null>(null)
  const [banks, setBanks] = useState<BankAccountSummary[] | null>(null)
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void getProviderPayments(locale)
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active) setData({ stats: EMPTY_STATS, payments: [] })
      })
    void listBankAccounts()
      .then((value) => {
        if (active) setBanks(value.bankAccounts ?? [])
      })
      .catch(() => {
        if (active) setBanks([])
      })
    return () => {
      active = false
    }
  }, [supabase, locale])

  if (!supabase) return null

  async function handleWithdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(amount.replace(",", "."))
    if (!Number.isFinite(value) || value < MIN_WITHDRAWAL) {
      setMessage(t("dashboard.professional.earnings.withdrawTooLow", { min: MIN_WITHDRAWAL }))
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      await processWithdrawal(value)
      setAmount("")
      toast(t("dashboard.professional.earnings.withdrawDone"))
      const refreshed = await listBankAccounts().catch(() => null)
      if (refreshed) setBanks(refreshed.bankAccounts ?? [])
    } catch (error) {
      setMessage((error as Error).message || t("common.tryAgain"))
    } finally {
      setBusy(false)
    }
  }

  async function handleBankLink() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await createBankAccountLink(window.location.href)
      if (result.url) window.location.href = result.url
    } catch (error) {
      setMessage((error as Error).message || t("common.tryAgain"))
    } finally {
      setBusy(false)
    }
  }

  const stats = data?.stats ?? EMPTY_STATS
  const payments = data?.payments ?? []
  const money = (value: number) => formatUsd(value, locale)

  return (
    <section
      id="banking"
      className="border-cream/10 bg-ink-card scroll-mt-6 rounded-4xl border p-6"
    >
      <div>
        <h2 className="font-display text-xl font-semibold">
          {t("dashboard.professional.earnings.title")}
        </h2>
        <p className="text-cream/50 mt-1 text-sm">{t("dashboard.professional.earnings.body")}</p>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["total", stats.totalEarnings],
            ["month", stats.monthlyEarnings],
            ["week", stats.weeklyEarnings],
            ["commissions", stats.totalCommissions],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="border-cream/10 bg-cream/2 rounded-2xl border p-4">
            <dt className="text-cream/50 text-xs">
              {t(`dashboard.professional.earnings.stats.${key}`)}
            </dt>
            <dd className="text-gold mt-1 text-lg font-semibold">{money(value)}</dd>
          </div>
        ))}
      </dl>

      {message && (
        <Alert tone="error" className="mt-4">
          {message}
        </Alert>
      )}

      {/* Banking + withdrawals */}
      <div className="border-cream/10 mt-6 rounded-3xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">
            {t("dashboard.professional.earnings.bankingTitle")}
          </h3>
          <Button
            variant="outline"
            size="sm"
            loading={busy}
            onClick={() => void handleBankLink()}
            iconLeft={<Icon name="wallet" className="size-4" />}
          >
            {t("dashboard.professional.earnings.manageBank")}
          </Button>
        </div>

        {banks === null ? (
          <div className="bg-cream/5 mt-3 h-14 animate-pulse rounded-2xl" />
        ) : banks.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {banks.map((bank) => (
              <li
                key={bank.id}
                className="border-cream/10 bg-cream/2 flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-sm"
              >
                <span className="text-cream/80">
                  {bank.bankName} •••• {bank.last4}
                </span>
                <span className="text-cream/50 text-xs uppercase">{bank.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-cream/50 mt-3 text-sm">
            {t("dashboard.professional.earnings.noBank")}
          </p>
        )}

        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleWithdraw}>
          <TextField
            label={t("dashboard.professional.earnings.withdrawLabel")}
            placeholder={String(MIN_WITHDRAWAL)}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-40"
          />
          <Button type="submit" size="sm" loading={busy}>
            {t("dashboard.professional.earnings.withdraw")}
          </Button>
        </form>
      </div>

      {/* Recent payments */}
      <div className="mt-6">
        <h3 className="font-display text-base font-semibold">
          {t("dashboard.professional.earnings.listTitle")}
        </h3>
        {payments.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {payments.slice(0, 12).map((payment) => (
              <li
                key={payment.id}
                className="border-cream/10 bg-cream/2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border px-4 py-3 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-cream block truncate font-medium">
                    {payment.clientName} · {payment.service}
                  </span>
                  <span className="text-cream/50 text-xs">{paymentStamp(payment, locale)}</span>
                </span>
                <span
                  className={
                    payment.status === "completed"
                      ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300 uppercase"
                      : "border-gold/30 bg-gold/10 text-gold rounded-full border px-2 py-0.5 text-[10px] uppercase"
                  }
                >
                  {t(
                    payment.status === "completed"
                      ? "dashboard.professional.earnings.statusCompleted"
                      : "dashboard.professional.earnings.statusPending",
                  )}
                </span>
                <span className="text-cream/85 font-semibold">{money(payment.netAmount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-cream/50 mt-3 text-sm">{t("dashboard.professional.earnings.empty")}</p>
        )}
      </div>
    </section>
  )
}

const EMPTY_STATS = {
  totalEarnings: 0,
  monthlyEarnings: 0,
  weeklyEarnings: 0,
  totalCommissions: 0,
  averagePayment: 0,
  totalClients: 0,
}

/** Money helper kept local so the section stays self-contained. */
function formatUsd(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(value)
  } catch {
    return `$${value.toFixed(2)}`
  }
}
