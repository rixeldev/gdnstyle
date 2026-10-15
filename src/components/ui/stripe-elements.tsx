"use client"

import { useMemo, useState, type FormEvent } from "react"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripeElementsOptions,
} from "@stripe/stripe-js"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { stripeAppearance, stripeLocale } from "@/libs/stripe/appearance"

/** Publishable key shared by every Stripe Element in the app. */
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""

const stripePromises = new Map<string, Promise<Stripe | null>>()

/** Memoised `loadStripe` so every form shares one Stripe.js instance. */
export function getStripePromise(publishableKey: string = STRIPE_PUBLISHABLE_KEY) {
  if (!publishableKey) return Promise.resolve(null)
  const existing = stripePromises.get(publishableKey)
  if (existing) return existing
  const created = loadStripe(publishableKey)
  stripePromises.set(publishableKey, created)
  return created
}

interface StripePaymentCardFormProps {
  clientSecret: string
  buttonLabel: string
  /** Receives the PaymentIntent id when the charge succeeds. */
  onSuccess: (paymentIntentId: string | null) => void | Promise<void>
  onError: (message: string) => void
}

/**
 * Embedded card form for a PaymentIntent (booking / shop checkout). Mounted
 * only after the server created the intent, so it never holds a key or a
 * secret of its own.
 */
export function StripePaymentCardForm({
  clientSecret,
  buttonLabel,
  onSuccess,
  onError,
}: StripePaymentCardFormProps) {
  const { i18n } = useTranslation()
  const stripe = getStripePromise()
  const locale = stripeLocale(i18n.language)

  const options = useMemo<StripeElementsOptions>(
    () => ({ clientSecret, appearance: stripeAppearance, locale }),
    [clientSecret, locale],
  )

  if (!STRIPE_PUBLISHABLE_KEY) return null

  return (
    <Elements key={`${clientSecret}-${locale}`} stripe={stripe} options={options}>
      <PaymentCardInner
        clientSecret={clientSecret}
        buttonLabel={buttonLabel}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  )
}

function PaymentCardInner({
  clientSecret,
  buttonLabel,
  onSuccess,
  onError,
}: StripePaymentCardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stripe || !elements) return

    setBusy(true)
    const result = await stripe.confirmPayment({
      elements: elements as StripeElements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    })

    if (result.error) {
      onError(result.error.message ?? "Card payment failed")
      setBusy(false)
      return
    }

    // The charge already went through, so never leave the button spinning:
    // release it whatever the post-payment bookkeeping does, and report a
    // rejection instead of letting it disappear as an unhandled rejection.
    try {
      await onSuccess(result.paymentIntent?.id ?? null)
    } catch (error) {
      onError((error as Error)?.message || "Card payment failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="border-cream/10 bg-cream/3 rounded-2xl border p-4">
        {/* Express wallet buttons (Apple Pay / Google Pay / Link) render white
            by brand mandate and cannot be themed, so they stay off; payment
            methods render as tabs in a row (`radios: "never"`), not as the
            default vertical radio-card column. */}
        <PaymentElement
          options={{
            layout: { type: "tabs", radios: "never" },
            wallets: { applePay: "never", googlePay: "never", link: "never" },
          }}
        />
      </div>
      <Button type="submit" loading={busy}>
        {buttonLabel}
      </Button>
    </form>
  )
}

interface StripeSetupCardFormProps {
  clientSecret: string
  buttonLabel: string
  onSuccess: () => void | Promise<void>
  onError: (message: string) => void
}

/**
 * Embedded card form backed by a SetupIntent: saves a card to the Stripe
 * customer without charging anything (dashboard "add card").
 */
export function StripeSetupCardForm({
  clientSecret,
  buttonLabel,
  onSuccess,
  onError,
}: StripeSetupCardFormProps) {
  const { i18n } = useTranslation()
  const stripe = getStripePromise()
  const locale = stripeLocale(i18n.language)

  const options = useMemo<StripeElementsOptions>(
    () => ({ clientSecret, appearance: stripeAppearance, locale }),
    [clientSecret, locale],
  )

  if (!STRIPE_PUBLISHABLE_KEY) return null

  return (
    <Elements key={`${clientSecret}-${locale}`} stripe={stripe} options={options}>
      <SetupCardInner
        clientSecret={clientSecret}
        buttonLabel={buttonLabel}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  )
}

function SetupCardInner({
  clientSecret,
  buttonLabel,
  onSuccess,
  onError,
}: StripeSetupCardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stripe || !elements) return

    setBusy(true)
    const result = await stripe.confirmSetup({
      elements: elements as StripeElements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    })

    if (result.error) {
      onError(result.error.message ?? "Card could not be saved")
      setBusy(false)
      return
    }

    // The card is already stored with Stripe at this point, so a failure here
    // is ours (refreshing the list, closing the dialog) and must never leave
    // the button spinning: release it and surface the reason either way.
    try {
      await onSuccess()
    } catch (error) {
      onError((error as Error)?.message || "Card could not be saved")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="border-cream/10 bg-cream/3 rounded-2xl border p-4">
        <PaymentElement options={{ layout: { type: "tabs", radios: "never" } }} />
      </div>
      <Button type="submit" loading={busy}>
        {buttonLabel}
      </Button>
    </form>
  )
}
