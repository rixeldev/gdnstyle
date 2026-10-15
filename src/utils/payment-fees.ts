/**
 * What a booking actually costs, mirrored from
 * `supabase/functions/create-booking-payment`.
 *
 * That Edge Function is the only place money moves, and it does not charge the
 * service price: it grosses it up so the platform keeps its cut and Stripe's
 * processing is covered, then charges the result.
 *
 *     total = (service + 0.50 + 0.30) / (1 - 0.029)
 *
 * So the checkout has to show that total, not the price of the service. The
 * expression below is deliberately the same one, in the same order — a cent of
 * drift between what the client was shown and what the card was charged is a
 * bug, and keeping the twins adjacent is what keeps them identical.
 */

/** Flat part of the platform's cut, per booking. */
export const PLATFORM_FEE = 0.5

/** Stripe's US card pricing, which the gross-up assumes. */
const STRIPE_FIXED_FEE = 0.3
const STRIPE_PERCENT_FEE = 0.029

/** The amount Stripe is asked to charge, in dollars (unrounded). */
export function bookingTotal(serviceAmount: number): number {
  const targetNet = serviceAmount + PLATFORM_FEE
  return (targetNet + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENT_FEE)
}

export interface BookingCharge {
  /** Price of the service itself, in cents. */
  serviceCents: number
  /** What processing adds on top, in cents. */
  feeCents: number
  /** What the card is charged, in cents. */
  totalCents: number
}

/**
 * The three numbers the checkout shows, in cents so they always add up: the
 * fee is derived from the rounded charge instead of being rounded on its own,
 * so `service + fee` can never land a cent away from `total`.
 */
export function bookingCharge(serviceAmount: number): BookingCharge {
  const serviceCents = Math.round(serviceAmount * 100)
  const totalCents = Math.round(bookingTotal(serviceAmount) * 100)
  return { serviceCents, feeCents: totalCents - serviceCents, totalCents }
}
