"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { StripePaymentCardForm, STRIPE_PUBLISHABLE_KEY } from "@/components/ui/stripe-elements"
import { TextField } from "@/components/ui/text-field"
import { FunctionError } from "@/libs/functions/invoke"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import type { DbAppointment } from "@/interfaces/appointments"
import { isSlotAvailable } from "@/services/availability.service"
import { SlotUnavailableError } from "@/services/appointments.service"
import {
  attachPaymentMethod,
  createAppointmentViaFunction,
  createBookingPayment,
  ensureStripeCustomer,
  listPaymentMethods,
  type BookingPaymentResult,
  type StripePaymentMethodSummary,
} from "@/services/payments.service"
import { formatCurrency } from "@/utils/format"
import { bookingCharge, type BookingCharge } from "@/utils/payment-fees"
import { fieldErrorsFrom } from "@/utils/zod"

/** Everything the Edge Function needs to create the `appointments` row. */
export interface CloudBookingContext {
  providerId: string
  serviceId: string
  serviceName: string | null
  locationId: string
  /** `YYYY-MM-DD`. */
  date: string
  /** `HH:MM`. */
  time: string
  durationMinutes?: number
  clientName?: string | null
  clientEmail?: string | null
  clientPhone?: number | null
}

interface PaymentFormProps {
  /** Amount in major units. The Edge Functions charge in USD. */
  amount: number
  amountLabel: string
  /** App locale (`en` / `es`), for the money lines that carry cents. */
  locale: string
  /** Live booking context: enables the real edge-function payment flow. */
  booking?: CloudBookingContext
  /** Creates the booking in the demo/local gateway (no Supabase). */
  onPaid: () => void | Promise<void>
  /** Cloud path: the `create-appointment` function created the row. */
  onCloudPaid?: (appointment: DbAppointment) => void | Promise<void>
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
 * created. With Supabase + a booking context it runs the real Stripe flow
 * through the Edge Functions (saved card / new card / pay in person);
 * otherwise it falls back to the safe simulation so the booking flow always
 * passes through a payment step.
 */
export function PaymentForm({
  amount,
  amountLabel,
  locale,
  booking,
  onPaid,
  onCloudPaid,
}: PaymentFormProps) {
  const supabase = getSupabaseBrowserClient()
  const cloudMode = Boolean(supabase && booking && onCloudPaid)

  if (cloudMode && booking && onCloudPaid) {
    return (
      <CloudPaymentForm
        booking={booking}
        amount={amount}
        locale={locale}
        onCloudPaid={onCloudPaid}
      />
    )
  }

  return <DemoPaymentForm amount={amount} amountLabel={amountLabel} onPaid={onPaid} />
}

type CloudMethod = "saved" | "new" | "in_person"

interface CloudPaymentFormProps {
  booking: CloudBookingContext
  amount: number
  locale: string
  onCloudPaid: (appointment: DbAppointment) => void | Promise<void>
}

/** Real payment step backed by the Supabase Edge Functions + Stripe Elements. */
function CloudPaymentForm({ booking, amount, locale, onCloudPaid }: CloudPaymentFormProps) {
  const { t } = useTranslation()
  const { user } = useSession()

  // What the card is really charged: the service price grossed up for the
  // platform cut and Stripe's processing. The Edge Function charges exactly
  // this, so the checkout has to show it rather than the service price.
  const localCharge = useMemo(() => bookingCharge(amount), [amount])
  // The price lives in the database, and the Edge Function reads it there. As
  // soon as it answers with the cents it charged, those take over from the
  // local mirror of the math — the button must never name a figure Stripe is
  // not going to charge.
  const [serverCharge, setServerCharge] = useState<BookingCharge | null>(null)
  const charge = serverCharge ?? localCharge
  const money = (cents: number) => formatCurrency(cents / 100, locale, "USD")

  const [cards, setCards] = useState<StripePaymentMethodSummary[] | null>(null)
  const [method, setMethod] = useState<CloudMethod>(STRIPE_PUBLISHABLE_KEY ? "new" : "in_person")
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [saveCard, setSaveCard] = useState(true)
  const [preparingCard, setPreparingCard] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // One PaymentIntent per visit to the new-card step: the parent re-renders
  // for reasons of its own, and a second intent would be a second charge
  // sitting there unconfirmed.
  const intentRequested = useRef(false)
  // Bumped by "try again" after a failed intent: the ref above is what allows
  // another attempt, this is what starts it.
  const [intentAttempt, setIntentAttempt] = useState(0)

  useEffect(() => {
    // Card payments need the publishable key; without it only "pay in person"
    // (cards stays null and the saved-card list simply renders as empty).
    if (!STRIPE_PUBLISHABLE_KEY) return
    let active = true
    void listPaymentMethods()
      .then((result) => {
        if (!active) return
        const list = result.paymentMethods ?? []
        setCards(list)
        if (list.length > 0) {
          setMethod("saved")
          setSelectedCardId(list[0].id)
        }
      })
      // No Stripe customer yet (or the function is not deployed): the list is
      // simply empty and the new-card option stays available.
      .catch(() => {
        if (active) setCards([])
      })
    return () => {
      active = false
    }
  }, [])

  // Stripe Elements can only mount once a PaymentIntent exists, so creating it
  // is what "use a new card" actually means. It runs the moment the option is
  // picked, instead of waiting for a second click whose only job was to say
  // "yes, now".
  useEffect(() => {
    // Wait for the saved-card list before doing anything: it decides whether
    // this visitor lands on a saved card or on "new card", and creating an
    // intent for an option that is about to be deselected is a charge waiting
    // to be wasted.
    if (cards === null || method !== "new" || clientSecret || intentRequested.current) return

    let cancelled = false
    intentRequested.current = true
    setMessage(null)
    setPreparingCard(true)

    void (async () => {
      try {
        await assertSlotAvailable()
        await ensureStripeCustomer(user?.email ?? "", user?.fullName ?? undefined)
        const payment = await createBookingPayment({
          amount,
          providerId: booking.providerId,
          metadata: {
            flow: "booking",
            service_id: booking.serviceId,
            client_user_id: user?.id ?? "",
          },
        })
        if (cancelled) return
        readServerCharge(payment)
        if (!payment.clientSecret) {
          intentRequested.current = false
          setMessage(t("venues.booking.paymentCardDeclined"))
          return
        }
        setClientSecret(payment.clientSecret)
      } catch (error) {
        if (cancelled) return
        intentRequested.current = false
        setMessage(failureMessage(error))
      } finally {
        if (!cancelled) setPreparingCard(false)
      }
    })()

    return () => {
      // Picked another option while the intent was being created (or clicked
      // retry): the answer gets thrown away, so the next visit to "new card"
      // has to be free to start over instead of waiting on a response nobody
      // will read, spinner included.
      cancelled = true
      intentRequested.current = false
      setPreparingCard(false)
    }
  }, [cards, method, clientSecret, intentAttempt])

  const appointmentInput = useMemo(
    () => ({
      serviceId: booking.serviceId,
      serviceName: booking.serviceName,
      providerId: booking.providerId,
      locationId: booking.locationId,
      scheduledDate: booking.date,
      scheduledTime: booking.time,
      durationMinutes: booking.durationMinutes ?? 30,
      price: amount,
    }),
    [booking, amount],
  )

  async function finishWithAppointment(paymentIntentId: string | null, paymentMethod: "stripe") {
    const result = await createAppointmentViaFunction({
      ...appointmentInput,
      paymentIntentId,
      paymentMethod,
    })
    await onCloudPaid(result.appointment)
  }

  /**
   * Adopt the exact figures the Edge Function charged with, so the total and
   * the pay button show what Stripe is really going to take. Older deploys do
   * not send them, in which case the local mirror stays in place.
   */
  function readServerCharge(payment: BookingPaymentResult) {
    if (typeof payment.totalCents !== "number" || typeof payment.serviceCents !== "number") return
    const feeCents =
      typeof payment.feeCents === "number"
        ? payment.feeCents
        : payment.totalCents - payment.serviceCents
    setServerCharge({
      serviceCents: payment.serviceCents,
      feeCents,
      totalCents: payment.totalCents,
    })
  }

  /**
   * Keep the card that just worked so the next booking can offer it as a saved
   * one. The charge is already done by this point, so a failure here is logged
   * and swallowed: a card that could not be stored must not turn a paid
   * booking into an error.
   */
  async function rememberCard(paymentMethodId: string) {
    try {
      await ensureStripeCustomer(user?.email ?? "", user?.fullName ?? undefined)
      await attachPaymentMethod(paymentMethodId)
    } catch (error) {
      console.error("[payments] the card was not saved for next time", error)
    }
  }

  /**
   * Error message for a failed payment/booking step. A slot that filled up
   * while the form was open gets its own copy instead of a generic failure.
   */
  function failureMessage(error: unknown): string {
    const slotTaken =
      error instanceof SlotUnavailableError ||
      (error instanceof FunctionError && error.serverCode === "SLOT_TAKEN")
    if (slotTaken) return t("venues.booking.slotTaken")
    return (error as Error)?.message || t("common.tryAgain")
  }

  /**
   * Re-check the chosen hour right before money moves: the grid may be stale
   * by the time the visitor submits, so refuse to charge for a taken slot.
   */
  async function assertSlotAvailable(): Promise<void> {
    const client = getSupabaseBrowserClient()
    if (!client) return
    const available = await isSlotAvailable(client, {
      providerId: booking.providerId,
      locationId: booking.locationId,
      dateKey: booking.date,
      time: booking.time,
      durationMinutes: booking.durationMinutes ?? 30,
    })
    if (!available) {
      throw new SlotUnavailableError("slot-taken")
    }
  }

  /**
   * Saved card and pay-in-person. The new card is not here: picking it creates
   * its own PaymentIntent (see the effect above) and Stripe's own form is what
   * the visitor submits, so this submit button never shows for it.
   */
  async function handleChoosePay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setBusy(true)

    try {
      await assertSlotAvailable()

      if (method === "in_person") {
        const result = await createAppointmentViaFunction({
          ...appointmentInput,
          paymentMethod: "in_person",
        })
        await onCloudPaid(result.appointment)
        return
      }

      if (method === "saved" && selectedCardId) {
        const payment = await createBookingPayment({
          amount,
          providerId: booking.providerId,
          paymentMethodId: selectedCardId,
          metadata: {
            flow: "booking",
            service_id: booking.serviceId,
            client_user_id: user?.id ?? "",
          },
        })
        if (payment.status !== "succeeded") {
          setMessage(t("venues.booking.paymentCardDeclined"))
          return
        }
        readServerCharge(payment)
        await finishWithAppointment(payment.paymentIntentId, "stripe")
      }
    } catch (error) {
      setMessage(failureMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const savedCards = cards ?? []
  const cardless = method === "in_person"
  // The card form replaces the method picker, but the "save this card" choice
  // belongs to both: it is decided in the picker and can still be changed while
  // the number is being typed, because the card is only stored after it works.
  const saveCardField = (
    <label className="text-cream/60 inline-flex cursor-pointer items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={saveCard}
        onChange={(event) => setSaveCard(event.target.checked)}
      />
      {t("venues.booking.saveCard")}
    </label>
  )

  return (
    <form onSubmit={handleChoosePay} noValidate className="mt-4 space-y-4">
      <div className="border-cream/10 bg-cream/3 rounded-2xl border px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-cream/60 inline-flex items-center gap-2">
            <Icon name="credit-card" className="size-4" />
            {t("venues.booking.paymentTotal")}
          </span>
          <span className="text-gold font-semibold">{money(charge.totalCents)}</span>
        </div>
        <dl className="border-cream/10 text-cream/50 mt-2 space-y-1 border-t pt-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt>{t("venues.booking.summaryPrice")}</dt>
            <dd>{money(charge.serviceCents)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>{t("venues.booking.processingFee")}</dt>
            <dd>{money(charge.feeCents)}</dd>
          </div>
        </dl>
      </div>

      {clientSecret ? (
        <>
          {saveCardField}
          <StripePaymentCardForm
            clientSecret={clientSecret}
            buttonLabel={t("venues.booking.payAmount", { amount: money(charge.totalCents) })}
            onSuccess={async (paymentIntentId, paymentMethodId) => {
              setMessage(null)
              // The charge already succeeded; a slot-taken answer here must be
              // surfaced instead of vanishing as an unhandled rejection. The
              // card is stored alongside the booking rather than after it:
              // `onCloudPaid` can navigate away, and a card that was proven
              // good by a successful charge should not depend on that.
              try {
                await Promise.all([
                  finishWithAppointment(paymentIntentId, "stripe"),
                  saveCard && paymentMethodId ? rememberCard(paymentMethodId) : Promise.resolve(),
                ])
              } catch (error) {
                setMessage(failureMessage(error))
              }
            }}
            onError={(value) => setMessage(value)}
          />
          <p className="text-cream/45 inline-flex items-center gap-2 text-xs">
            <Icon name="shield" className="size-4 shrink-0" />
            {t("venues.booking.paymentStripe")}
          </p>
        </>
      ) : (
        <>
          {savedCards.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="text-cream/70 mb-1 text-sm">
                {t("venues.booking.savedCards")}
              </legend>
              {savedCards.map((card, index) => (
                <label
                  key={card.id}
                  className="border-cream/10 bg-cream/3 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="savedCard"
                      checked={selectedCardId === card.id}
                      onChange={() => {
                        setMethod("saved")
                        setSelectedCardId(card.id)
                      }}
                    />
                    <span className="capitalize">
                      {card.brand} •••• {card.last4}
                    </span>
                    <span className="text-cream/50">
                      {card.exp_month.toString().padStart(2, "0")}/{card.exp_year}
                    </span>
                  </span>
                  {index === 0 && (
                    <span className="text-gold/80 text-xs">{t("venues.booking.defaultCard")}</span>
                  )}
                </label>
              ))}
            </fieldset>
          )}

          <label className="border-cream/10 bg-cream/3 flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
            <input
              type="radio"
              name="payMethod"
              checked={method === "new"}
              onChange={() => setMethod("new")}
            />
            <Icon name="credit-card" className="size-4" />
            {t("venues.booking.newCard")}
          </label>

          {method === "new" && (
            <div className="border-cream/10 bg-cream/3 space-y-3 rounded-2xl border px-4 py-3 pl-12">
              {saveCardField}
              {preparingCard ? (
                <p className="text-cream/50 inline-flex items-center gap-2 text-xs">
                  <Icon name="clock" className="size-4" />
                  {t("venues.booking.preparingCardForm")}
                </p>
              ) : (
                !clientSecret && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIntentAttempt((value) => value + 1)}
                  >
                    {t("common.retry")}
                  </Button>
                )
              )}
            </div>
          )}

          <label className="border-cream/10 bg-cream/3 flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
            <input
              type="radio"
              name="payMethod"
              checked={cardless}
              onChange={() => setMethod("in_person")}
            />
            <Icon name="calendar" className="size-4" />
            <span>
              {t("venues.booking.payInPerson")}
              <span className="text-cream/50 block text-xs">
                {t("venues.booking.payInPersonHint")}
              </span>
            </span>
          </label>

          {/* The new card submits through Stripe's own form, which mounts with
              its own button; this one only serves the other two methods. */}
          {method !== "new" && (
            <Button type="submit" loading={busy} className="w-full">
              {t("venues.booking.pay")}
            </Button>
          )}
        </>
      )}

      {message && <p className="text-danger text-sm leading-relaxed">{message}</p>}

      <p className="text-cream/45 inline-flex items-center gap-2 text-xs">
        <Icon name="shield" className="size-4 shrink-0" />
        {t("venues.booking.paymentPendingNote")}
      </p>
    </form>
  )
}

interface DemoPaymentFormProps {
  amount: number
  amountLabel: string
  onPaid: () => void | Promise<void>
}

/**
 * Local test gateway: validates the card shape, then hands off to
 * `/api/checkout` (Stripe Checkout) when provider keys are configured, or
 * runs a safe simulation. Used when Supabase is not configured.
 */
function DemoPaymentForm({ amount, amountLabel, onPaid }: DemoPaymentFormProps) {
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
    try {
      // Keep the button loading until the booking is actually persisted.
      await onPaid()
    } finally {
      setProcessing(false)
    }
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
