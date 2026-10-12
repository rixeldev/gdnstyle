import { NextResponse } from "next/server"

/**
 * Optional real payment path.
 *
 * The booking flow always goes through a payment step (see `PaymentForm`). When
 * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` are set the form
 * asks this route for a Stripe Checkout Session and hands off to Stripe; the
 * booking is created from the success return. Without keys the form uses its
 * local test gateway instead, so the marketplace works out of the box.
 *
 * This endpoint is intentionally dependency-free: it calls the Stripe REST API
 * directly with `fetch`, so no extra package is required to enable it.
 */

interface CheckoutBody {
  amount?: number
  description?: string
}

const STRIPE_CHECKOUT_URL = "https://api.stripe.com/v1/checkout/sessions"

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 501 })
  }

  const body = (await request.json().catch(() => null)) as CheckoutBody | null
  const amount = Math.round(Number(body?.amount ?? 0))

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 })
  }

  const { origin } = new URL(request.url)
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "dop",
    "line_items[0][price_data][unit_amount]": String(amount * 100),
    "line_items[0][price_data][product_data][name]": body?.description ?? "GDN Style appointment",
    success_url: `${origin}/dashboard?paid=1`,
    cancel_url: `${origin}/dashboard?paid=0`,
  })

  const response = await fetch(STRIPE_CHECKOUT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  })

  const data = (await response.json().catch(() => null)) as {
    id?: string
    url?: string
    error?: { message?: string }
  } | null

  if (!response.ok || !data?.url) {
    return NextResponse.json(
      { error: data?.error?.message ?? "stripe_error" },
      { status: response.status || 502 },
    )
  }

  return NextResponse.json({ id: data.id, url: data.url })
}
