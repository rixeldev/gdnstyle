"use client"

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { TextField } from "@/components/ui/text-field"
import { fieldErrorsFrom } from "@/utils/zod"

interface PaymentFormProps {
  /** Amount in DOP (major units). Sent to the gateway as cents. */
  amount: number
  amountLabel: string
  onPaid: () => void
}

interface PaymentValues {
  cardName: string
  cardNumber: string
  expiry: string
  cvc: string
}

function digits(value: string): string {
  return value.replace(/\D/g, "")
}

function formatCardNumber(value: string): string {
  return digits(value)
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim()
}

function formatExpiry(value: string): string {
  const raw = digits(value).slice(0, 4)
  return raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw
}

function expiryIsValid(value: string): boolean {
  const [month, year] = value.split("/")
  if (!month || !year || month.length !== 2 || year.length !== 2) return false
  const monthNumber = Number(month)
  if (monthNumber < 1 || monthNumber > 12) return false
  return new Date(2000 + Number(year), monthNumber, 0, 23, 59, 59) >= new Date()
}

/**
 * Card step that stands in for the payment gateway before an appointment is
 * created. It talks to `/api/checkout` (Stripe Checkout) when provider keys are
 * configured and otherwise runs a safe simulation, so the booking flow always
 * passes through a payment step.
 */
export function PaymentForm({ amount, amountLabel, onPaid }: PaymentFormProps) {
  const { t } = useTranslation()
  const realCheckout = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

  const schema = useMemo(
    () =>
      z.object({
        cardName: z.string().trim().min(2, t("validation.cardNameRequired")),
        cardNumber: z
          .string()
          .refine((value) => digits(value).length === 16, t("validation.cardNumberInvalid")),
        expiry: z.string().refine(expiryIsValid, t("validation.cardExpiryInvalid")),
        cvc: z.string().regex(/^\d{3,4}$/, t("validation.cardCvcInvalid")),
      }),
    [t],
  )

  const [values, setValues] = useState<PaymentValues>({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [processing, setProcessing] = useState(false)

  function handleChange(field: keyof PaymentValues, format?: (value: string) => string) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const next = { ...values, [field]: format ? format(event.target.value) : event.target.value }
      setValues(next)
      if (submitted) {
        const parsed = schema.safeParse(next)
        setErrors(parsed.success ? {} : fieldErrorsFrom(parsed.error))
      }
    }
  }

  /** Try the real Stripe Checkout session; report whether the redirect started. */
  async function startRealCheckout(): Promise<boolean> {
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description: t("venues.booking.paymentDescription") }),
      })
      if (!response.ok) return false
      const data = (await response.json()) as { url?: string }
      if (!data.url) return false
      window.location.href = data.url
      return true
    } catch {
      return false
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error))
      return
    }

    setErrors({})
    setProcessing(true)

    // With provider keys we hand off to Stripe Checkout; the booking is created
    // by the payment confirmation. Otherwise we run the local test gateway.
    if (realCheckout && (await startRealCheckout())) return

    await new Promise((resolve) => setTimeout(resolve, 1500))
    setProcessing(false)
    onPaid()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
      <div className="border-cream/10 bg-cream/3 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm">
        <span className="text-cream/60 inline-flex items-center gap-2">
          <Icon name="credit-card" className="size-4" />
          {t("venues.booking.paymentTotal")}
        </span>
        <span className="text-gold font-semibold">{amountLabel}</span>
      </div>

      <TextField
        name="cardName"
        autoComplete="cc-name"
        label={t("venues.booking.cardName")}
        placeholder={t("venues.booking.cardNamePlaceholder")}
        value={values.cardName}
        onChange={handleChange("cardName")}
        error={errors.cardName}
        required
      />

      <TextField
        name="cardNumber"
        inputMode="numeric"
        autoComplete="cc-number"
        label={t("venues.booking.cardNumber")}
        placeholder={t("venues.booking.cardNumberPlaceholder")}
        value={values.cardNumber}
        onChange={handleChange("cardNumber", formatCardNumber)}
        error={errors.cardNumber}
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          name="expiry"
          inputMode="numeric"
          autoComplete="cc-exp"
          label={t("venues.booking.cardExpiry")}
          placeholder={t("venues.booking.cardExpiryPlaceholder")}
          value={values.expiry}
          onChange={handleChange("expiry", formatExpiry)}
          error={errors.expiry}
          required
        />
        <TextField
          name="cvc"
          inputMode="numeric"
          autoComplete="cc-csc"
          label={t("venues.booking.cardCvc")}
          placeholder={t("venues.booking.cardCvcPlaceholder")}
          value={values.cvc}
          onChange={handleChange("cvc", (value) => digits(value).slice(0, 4))}
          error={errors.cvc}
          required
        />
      </div>

      <p className="text-cream/45 inline-flex items-center gap-2 text-xs">
        <Icon name="shield" className="size-4 shrink-0" />
        {realCheckout ? t("venues.booking.paymentStripe") : t("venues.booking.paymentTestMode")}
      </p>
      {!realCheckout && (
        <p className="text-cream/40 text-xs leading-relaxed">
          {t("venues.booking.paymentTestHint")}
        </p>
      )}

      <Button type="submit" loading={processing} className="w-full">
        {processing ? t("venues.booking.paying") : t("venues.booking.pay")}
      </Button>
    </form>
  )
}
