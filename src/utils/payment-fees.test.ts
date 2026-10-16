import { describe, expect, it } from "vitest"

import { bookingCharge, bookingTotal, PLATFORM_FEE } from "@/utils/payment-fees"

/**
 * `supabase/functions/create-booking-payment` is the only place money moves.
 * The expression below repeats its arithmetic verbatim, so a change to either
 * side has to be made twice — or fails here, before it ships.
 */
function chargedByTheEdgeFunction(serviceAmount: number): number {
  const platformFee = 0.5
  const targetNet = serviceAmount + platformFee
  const totalAmount = (targetNet + 0.3) / (1 - 0.029)
  return Math.round(totalAmount * 100)
}

describe("bookingCharge", () => {
  it("charges the same cents create-booking-payment charges", () => {
    for (const amount of [1, 5, 10, 25.5, 33.33, 50, 79.9, 99.99, 150, 480, 1200]) {
      expect(bookingCharge(amount).totalCents).toBe(chargedByTheEdgeFunction(amount))
    }
  })

  it("always adds up: service price + processing fee = total", () => {
    for (const amount of [1, 7.25, 33.33, 50, 120.4, 999.99]) {
      const { serviceCents, feeCents, totalCents } = bookingCharge(amount)
      expect(serviceCents + feeCents).toBe(totalCents)
      // The gross-up exists to cover the fee: it is never zero.
      expect(feeCents).toBeGreaterThan(0)
    }
  })

  it("shows 52.32 for a 50.00 service", () => {
    expect(bookingCharge(50)).toEqual({ serviceCents: 5000, feeCents: 232, totalCents: 5232 })
  })

  it("derives the fee off the rounded charge, so the lines never drift a cent", () => {
    const { serviceCents, totalCents, feeCents } = bookingCharge(33.33)
    expect(serviceCents).toBe(3333)
    expect(totalCents).toBe(3515)
    expect(feeCents).toBe(182)
  })
})

describe("bookingTotal", () => {
  it("keeps the platform's flat cut inside the formula", () => {
    expect(PLATFORM_FEE).toBe(0.5)
    expect(bookingTotal(0)).toBeCloseTo((PLATFORM_FEE + 0.3) / (1 - 0.029), 10)
  })

  it("grows with the price of the service", () => {
    expect(bookingTotal(100)).toBeGreaterThan(bookingTotal(50))
    expect(bookingTotal(50)).toBeGreaterThan(50)
  })
})
