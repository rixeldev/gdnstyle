"use client"

import { useEffect, useId, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Icon } from "@/components/ui/icon"
import { Modal } from "@/components/ui/modal"
import { StripeSetupCardForm, STRIPE_PUBLISHABLE_KEY } from "@/components/ui/stripe-elements"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { useStoredList } from "@/hooks/use-stored-list"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { createId } from "@/libs/storage"
import {
  createPaymentCardSchema,
  detectBrand,
  formatCardExpiry,
  formatCardNumber,
  parseCardExpiry,
  type PaymentBrand,
} from "@/libs/validation/payment-methods"
import {
  createSetupIntent,
  deletePaymentMethod,
  ensureStripeCustomer,
  listPaymentMethods,
  setDefaultPaymentMethod,
  type StripePaymentMethodSummary,
} from "@/services/payments.service"
import { fieldErrorsFrom } from "@/utils/zod"

const METHODS_KEY = "gdn.paymentMethods"

/**
 * Saved card reference. Only non-sensitive metadata is stored (brand, last
 * four digits, expiry, holder) — never the full number or any security code.
 */
export interface PaymentMethod {
  id: string
  brand: PaymentBrand
  last4: string
  expMonth: number
  expYear: number
  holder: string
  isDefault?: boolean
}

/** Names: letters (any script), spaces and the usual separators — no digits. */
function sanitizeHolder(raw: string): string {
  return raw.replace(/[^\p{L}\s'.\u2010-\u2015-]/gu, "").slice(0, 60)
}

interface CardFormFields {
  holder: string
  number: string
  expiry: string
}

interface AddCardDialogProps {
  onAdd: (method: PaymentMethod) => void
  onClose: () => void
}

function AddCardDialog({ onAdd, onClose }: AddCardDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const schema = useMemo(() => createPaymentCardSchema((key) => t(key)), [t])
  const [holder, setHolder] = useState("")
  const [number, setNumber] = useState("")
  const [expiry, setExpiry] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const numberDigits = number.replace(/\D/g, "")
  // The brand shows up as soon as the digits reveal it, without submitting.
  const brandHint =
    numberDigits.length > 0
      ? t(`dashboard.customer.payments.brands.${detectBrand(numberDigits)}`)
      : undefined

  /** Runs the zod schema (number normalized to digits) and mirrors errors. */
  function validateWith(fields: CardFormFields) {
    const parsed = schema.safeParse({ ...fields, number: fields.number.replace(/\D/g, "") })
    setErrors(parsed.success ? {} : fieldErrorsFrom(parsed.error))
    return parsed
  }

  /** Applies one field change; after the first submit every change revalidates. */
  function update(fields: Partial<CardFormFields>) {
    const next = { holder, number, expiry, ...fields }
    if (fields.holder !== undefined) setHolder(next.holder)
    if (fields.number !== undefined) setNumber(next.number)
    if (fields.expiry !== undefined) setExpiry(next.expiry)
    if (submitted) validateWith(next)
  }

  function handleHolderChange(event: ChangeEvent<HTMLInputElement>) {
    update({ holder: sanitizeHolder(event.target.value) })
  }

  function handleNumberChange(event: ChangeEvent<HTMLInputElement>) {
    update({ number: formatCardNumber(event.target.value) })
  }

  function handleExpiryChange(event: ChangeEvent<HTMLInputElement>) {
    update({ expiry: formatCardExpiry(event.target.value) })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    const parsed = validateWith({ holder, number, expiry })
    if (!parsed.success) return

    // The schema already proved the expiry parses into a real month/year.
    const exp = parseCardExpiry(parsed.data.expiry)
    if (!exp) return

    onAdd({
      id: createId("card"),
      brand: detectBrand(parsed.data.number),
      last4: parsed.data.number.slice(-4),
      expMonth: exp.month,
      expYear: exp.year,
      holder: parsed.data.holder,
    })
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <form onSubmit={handleSubmit} noValidate className="p-5">
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {t("dashboard.customer.payments.addTitle")}
        </h2>
        <p className="text-cream/50 mt-1 text-sm">{t("dashboard.customer.payments.addSubtitle")}</p>

        <div className="mt-5 space-y-4">
          <TextField
            label={t("dashboard.customer.payments.holder")}
            value={holder}
            onChange={handleHolderChange}
            error={errors.holder}
            autoComplete="cc-name"
            required
          />
          <TextField
            label={t("dashboard.customer.payments.number")}
            value={number}
            onChange={handleNumberChange}
            error={errors.number}
            hint={brandHint}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            required
          />
          <TextField
            label={t("dashboard.customer.payments.expiry")}
            value={expiry}
            onChange={handleExpiryChange}
            error={errors.expiry}
            hint={t("dashboard.customer.payments.expiryHint")}
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="12/29"
            required
          />
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" size="sm">
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Wallet-style list for the customer dashboard. With Supabase configured the
 * cards live in Stripe (managed by the Edge Functions); without credentials
 * they are local demo records in this browser only, which the section states
 * plainly.
 */
export function PaymentMethodsSection() {
  const supabase = getSupabaseBrowserClient()
  if (supabase) return <CloudPaymentMethodsSection />
  return <DemoPaymentMethodsSection />
}

function DemoPaymentMethodsSection() {
  const { t } = useTranslation()
  const { items: methods, ready, mutate } = useStoredList<PaymentMethod>(METHODS_KEY)
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PaymentMethod | null>(null)

  function handleAdd(method: PaymentMethod) {
    mutate((previous) => [method, ...previous])
    setAdding(false)
    toast(t("dashboard.customer.payments.added"))
  }

  function handleSetDefault(id: string) {
    mutate((previous) => previous.map((item) => ({ ...item, isDefault: item.id === id })))
    toast(t("dashboard.customer.payments.madeDefault"))
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return
    const deleted = pendingDelete
    mutate((previous) => {
      const next = previous.filter((item) => item.id !== deleted.id)
      // Keep exactly one default: promote the first survivor.
      if (deleted.isDefault && next.length > 0 && !next.some((item) => item.isDefault)) {
        return next.map((item, index) => ({ ...item, isDefault: index === 0 }))
      }
      return next
    })
    setPendingDelete(null)
    toast(t("dashboard.customer.payments.removed"))
  }

  return (
    <section className="border-cream/10 bg-ink-card rounded-4xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {t("dashboard.customer.payments.title")}
          </h2>
          <p className="text-cream/50 mt-1 text-sm">{t("dashboard.customer.payments.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          iconLeft={<Icon name="credit-card" className="size-4" />}
        >
          {t("dashboard.customer.payments.add")}
        </Button>
      </div>

      {!ready ? (
        <div className="mt-5 space-y-3">
          {[0, 1].map((index) => (
            <div key={index} className="bg-cream/5 h-16 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : methods.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {methods.map((method) => (
            <li
              key={method.id}
              className="border-cream/10 bg-cream/2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5"
            >
              <span className="border-gold/25 bg-gold/10 text-gold flex size-11 shrink-0 items-center justify-center rounded-2xl border">
                <Icon name="credit-card" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-cream block text-sm font-semibold">
                  {t(`dashboard.customer.payments.brands.${method.brand}`)} •••• {method.last4}
                </span>
                <span className="text-cream/50 mt-0.5 block text-xs">
                  {t("dashboard.customer.payments.expires", {
                    date: `${String(method.expMonth).padStart(2, "0")}/${String(
                      method.expYear,
                    ).slice(-2)}`,
                  })}
                  {" · "}
                  {method.holder}
                </span>
              </span>
              {method.isDefault ? (
                <span className="border-gold/30 bg-gold/10 text-gold inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
                  <Icon name="badge-check" className="h-3.5 w-3.5" />
                  {t("dashboard.customer.payments.defaultBadge")}
                </span>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => handleSetDefault(method.id)}>
                  {t("dashboard.customer.payments.setDefault")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingDelete(method)}
                iconLeft={<Icon name="trash" className="size-4" />}
              >
                {t("dashboard.customer.payments.remove")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-cream/10 mt-5 flex flex-col items-center gap-4 rounded-3xl border border-dashed px-6 py-8 text-center">
          <Icon name="credit-card" className="text-cream/25 size-7" />
          <p className="text-cream/55 text-sm">{t("dashboard.customer.payments.empty")}</p>
          <Button size="sm" onClick={() => setAdding(true)}>
            {t("dashboard.customer.payments.add")}
          </Button>
        </div>
      )}

      <p className="text-cream/35 mt-4 text-xs leading-relaxed">
        {t("dashboard.customer.payments.demoNote")}
      </p>

      {adding && <AddCardDialog onAdd={handleAdd} onClose={() => setAdding(false)} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("dashboard.customer.payments.removeConfirmTitle")}
        body={
          pendingDelete
            ? t("dashboard.customer.payments.removeConfirmBody", {
                brand: t(`dashboard.customer.payments.brands.${pendingDelete.brand}`),
                last4: pendingDelete.last4,
              })
            : undefined
        }
        confirmLabel={t("dashboard.customer.payments.remove")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  )
}

/** Add-card dialog backed by a Stripe SetupIntent (no charge). */
function CloudAddCardDialog({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useSession()
  const titleId = useId()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        await ensureStripeCustomer(user?.email ?? "", user?.fullName ?? undefined)
        const setup = await createSetupIntent()
        if (active) setClientSecret(setup.clientSecret)
      } catch (error) {
        if (active) setMessage((error as Error).message || t("common.tryAgain"))
      }
    })()
    return () => {
      active = false
    }
  }, [user?.email, user?.fullName, t])

  return (
    <Modal open onClose={onClose} labelledBy={titleId} className="max-w-xl">
      <div className="p-5">
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {t("dashboard.customer.payments.addTitle")}
        </h2>
        <p className="text-cream/50 mt-1 text-sm">{t("dashboard.customer.payments.addSubtitle")}</p>

        <div className="mt-5">
          {clientSecret && STRIPE_PUBLISHABLE_KEY ? (
            <StripeSetupCardForm
              clientSecret={clientSecret}
              buttonLabel={t("common.save")}
              onSuccess={() => {
                // Order matters: refresh first, then close, so a failing
                // refresh leaves the dialog open to show the reason instead of
                // silently swallowing the success.
                onDone()
                toast(t("dashboard.customer.payments.added"))
                onClose()
              }}
              onError={(value) => setMessage(value)}
            />
          ) : message ? null : (
            <p className="text-cream/55 text-sm">{t("common.loading")}</p>
          )}
          {message && <p className="text-danger mt-3 text-sm leading-relaxed">{message}</p>}
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Stripe-backed wallet: list / delete / set default via the Edge Functions. */
function CloudPaymentMethodsSection() {
  const { t } = useTranslation()
  const [methods, setMethods] = useState<StripePaymentMethodSummary[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<StripePaymentMethodSummary | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function reload() {
    try {
      const result = await listPaymentMethods()
      setMethods(result.paymentMethods ?? [])
      setMessage(null)
    } catch {
      setMethods([])
    }
  }

  useEffect(() => {
    let active = true
    listPaymentMethods()
      .then((result) => {
        if (active) setMethods(result.paymentMethods ?? [])
      })
      .catch(() => {
        if (active) setMethods([])
      })
    return () => {
      active = false
    }
  }, [])

  function handleSetDefault(id: string) {
    void setDefaultPaymentMethod(id)
      .then(() => reload())
      .then(() => toast(t("dashboard.customer.payments.madeDefault")))
      .catch(() => setMessage(t("common.tryAgain")))
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return
    const deleted = pendingDelete
    setPendingDelete(null)
    void deletePaymentMethod(deleted.id)
      .then(() => reload())
      .then(() => toast(t("dashboard.customer.payments.removed")))
      .catch(() => setMessage(t("common.tryAgain")))
  }

  const list = methods ?? []

  return (
    <section className="border-cream/10 bg-ink-card rounded-4xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {t("dashboard.customer.payments.title")}
          </h2>
          <p className="text-cream/50 mt-1 text-sm">{t("dashboard.customer.payments.subtitle")}</p>
        </div>
        {STRIPE_PUBLISHABLE_KEY && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            iconLeft={<Icon name="credit-card" className="size-4" />}
          >
            {t("dashboard.customer.payments.add")}
          </Button>
        )}
      </div>

      {methods === null ? (
        <div className="mt-5 space-y-3">
          {[0, 1].map((index) => (
            <div key={index} className="bg-cream/5 h-16 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : list.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {list.map((method, index) => (
            <li
              key={method.id}
              className="border-cream/10 bg-cream/2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5"
            >
              <span className="border-gold/25 bg-gold/10 text-gold flex size-11 shrink-0 items-center justify-center rounded-2xl border">
                <Icon name="credit-card" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-cream block text-sm font-semibold capitalize">
                  {method.brand} •••• {method.last4}
                </span>
                <span className="text-cream/50 mt-0.5 block text-xs">
                  {t("dashboard.customer.payments.expires", {
                    date: `${String(method.exp_month).padStart(2, "0")}/${String(
                      method.exp_year,
                    ).slice(-2)}`,
                  })}
                </span>
              </span>
              {index === 0 ? (
                <span className="border-gold/30 bg-gold/10 text-gold inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
                  <Icon name="badge-check" className="h-3.5 w-3.5" />
                  {t("dashboard.customer.payments.defaultBadge")}
                </span>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => handleSetDefault(method.id)}>
                  {t("dashboard.customer.payments.setDefault")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingDelete(method)}
                iconLeft={<Icon name="trash" className="size-4" />}
              >
                {t("dashboard.customer.payments.remove")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-cream/10 mt-5 flex flex-col items-center gap-4 rounded-3xl border border-dashed px-6 py-8 text-center">
          <Icon name="credit-card" className="text-cream/25 size-7" />
          <p className="text-cream/55 text-sm">{t("dashboard.customer.payments.empty")}</p>
          {STRIPE_PUBLISHABLE_KEY && (
            <Button size="sm" onClick={() => setAdding(true)}>
              {t("dashboard.customer.payments.add")}
            </Button>
          )}
        </div>
      )}

      <p className="text-cream/35 mt-4 text-xs leading-relaxed">
        {t("dashboard.customer.payments.secureNote")}
      </p>
      {message && <p className="text-danger mt-2 text-sm">{message}</p>}

      {adding && (
        <CloudAddCardDialog onDone={() => void reload()} onClose={() => setAdding(false)} />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("dashboard.customer.payments.removeConfirmTitle")}
        body={
          pendingDelete
            ? t("dashboard.customer.payments.removeConfirmBody", {
                brand: pendingDelete.brand,
                last4: pendingDelete.last4,
              })
            : undefined
        }
        confirmLabel={t("dashboard.customer.payments.remove")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  )
}
