import type { SupabaseClient } from "@supabase/supabase-js"

import { invokeFunction } from "@/libs/functions/invoke"
import type { DbAppointment } from "@/interfaces/appointments"

/**
 * Typed wrappers around the Supabase Edge Functions that own the Stripe
 * integration. Every function authenticates with the signed-in user's JWT,
 * so these helpers must run in the browser of a signed-in user (the only
 * exception is `sendWelcomeEmail`, which has no auth of its own).
 */

export interface StripePaymentMethodSummary {
  id: string
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

export interface BookingPaymentResult {
  clientSecret: string | null
  paymentIntentId: string | null
  appointmentId: string | null
  status: string
  /**
   * What the server actually charged, in cents. Present once the pricing lives
   * in the Edge Function; the form prefers these over its own mirror of the
   * fee math, so the number on the button and the number charged cannot drift
   * apart when the service price changes mid-checkout.
   */
  serviceCents?: number | null
  feeCents?: number | null
  totalCents?: number | null
}

export interface ProviderPaymentRow {
  id: string
  clientName: string
  service: string
  amount: number
  commission: number
  netAmount: number
  paymentMethod: string
  /** Pre-formatted `DD/MM/YYYY` by the function. */
  date: string
  /** Pre-formatted `HH:MM` by the function. */
  time: string
  status: string
  transactionId: string
  created_at: string
}

export interface ProviderPaymentsStats {
  totalEarnings: number
  monthlyEarnings: number
  weeklyEarnings: number
  totalCommissions: number
  averagePayment: number
  totalClients: number
}

export interface ProviderPaymentsPayload {
  stats: ProviderPaymentsStats
  payments: ProviderPaymentRow[]
}

export interface BankAccountSummary {
  id: string
  bankName: string
  last4: string
  country: string
  currency: string
  status: string
  isDefault: boolean
}

export interface ProviderStripeState {
  stripeAccountId: string | null
  onboardingCompleted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  requirementsDue: string[]
  identityVerified: boolean
  accountReady: boolean
}

export interface ProviderCardPayload {
  hasCard: boolean
  cardStatus: string | null
  identityVerified?: boolean
  card: {
    id: string
    last4: string
    brand: string
    exp_month: number
    exp_year: number
    status: string
    type: string
    cardholder_name: string
  } | null
  /** Dollars available on the card's issuing balance. */
  balance: number | null
  transactions: Array<{
    id: string
    /** Cents. */
    amount: number
    /** Dollars. */
    amount_dollars: number
    merchant_name: string
    category: string
    /** Unix seconds. */
    created: number
    date: string
    status: string
  }>
}

/* -------------------------------------------------------------------------- */
/* Client payment methods                                                      */
/* -------------------------------------------------------------------------- */

export function ensureStripeCustomer(email: string, name?: string) {
  return invokeFunction<{ customerId: string }>("manage-client-payment-methods", {
    action: "get_or_create_customer",
    email,
    name,
    shopContext: "client",
  })
}

export function listPaymentMethods(shopContext: "client" | "provider" = "client") {
  return invokeFunction<{ paymentMethods: StripePaymentMethodSummary[] }>(
    "manage-client-payment-methods",
    { action: "list", shopContext },
  )
}

export function deletePaymentMethod(paymentMethodId: string) {
  return invokeFunction<{ success: boolean }>("manage-client-payment-methods", {
    action: "delete",
    paymentMethodId,
    shopContext: "client",
  })
}

export function setDefaultPaymentMethod(paymentMethodId: string) {
  return invokeFunction<{ success: boolean }>("manage-client-payment-methods", {
    action: "set_default",
    paymentMethodId,
    shopContext: "client",
  })
}

/**
 * Attach a card that was just charged to the Stripe customer, so the next
 * booking can offer it as a saved card. Done after the payment instead of
 * through `setup_future_usage` on the PaymentIntent: the card is only worth
 * keeping once it worked, and the "save this card" choice can then be changed
 * at any moment without invalidating the form the visitor is already typing in.
 */
export function attachPaymentMethod(paymentMethodId: string) {
  return invokeFunction<{ success: boolean }>("manage-client-payment-methods", {
    action: "attach",
    paymentMethodId,
    shopContext: "client",
  })
}

/** SetupIntent (no charge) so the dashboard can register a new card. */
export function createSetupIntent(shopContext: "client" | "provider" = "client") {
  return invokeFunction<{ clientSecret: string; setupIntentId: string }>("create-setup-intent", {
    shopContext,
  })
}

/* -------------------------------------------------------------------------- */
/* Booking payments                                                            */
/* -------------------------------------------------------------------------- */

export function createBookingPayment(input: {
  amount: number
  providerId: string
  currency?: string
  paymentMethodId?: string
  metadata?: Record<string, string>
}) {
  return invokeFunction<BookingPaymentResult>("create-booking-payment", {
    amount: input.amount,
    currency: input.currency ?? "usd",
    providerId: input.providerId,
    paymentMethodId: input.paymentMethodId,
    metadata: input.metadata,
  })
}

/**
 * Create the `appointments` row through the `create-appointment` Edge
 * Function (verifies the PaymentIntent, deduplicates, links the
 * provider_payments row). `in_person` books without any Stripe charge.
 */
export function createAppointmentViaFunction(
  input: {
    paymentIntentId?: string | null
    paymentMethod: "stripe" | "in_person"
    serviceId: string
    serviceName?: string | null
    providerId: string
    locationId: string
    scheduledDate: string
    scheduledTime: string
    durationMinutes?: number | null
    price: number
    notes?: string | null
  },
  supabase?: SupabaseClient,
) {
  void supabase
  return invokeFunction<{ success: boolean; appointment: DbAppointment }>("create-appointment", {
    paymentIntentId: input.paymentIntentId ?? undefined,
    paymentMethod: input.paymentMethod,
    serviceId: input.serviceId,
    serviceName: input.serviceName ?? undefined,
    providerId: input.providerId,
    locationId: input.locationId,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    durationMinutes: input.durationMinutes ?? undefined,
    price: input.price,
    notes: input.notes ?? undefined,
  })
}

/** Professional resolves a client's refund request (approve runs Stripe). */
export function processRefund(
  appointmentId: string,
  action: "approve" | "reject",
  reason?: string,
) {
  return invokeFunction<{ success: boolean; refund_id?: string }>("process-refund", {
    appointmentId,
    action,
    reason,
  })
}

/* -------------------------------------------------------------------------- */
/* Provider finances                                                           */
/* -------------------------------------------------------------------------- */

export function getProviderPayments() {
  return invokeFunction<ProviderPaymentsPayload>("get-provider-payments", {})
}

export function processWithdrawal(amount: number) {
  return invokeFunction<{ success: boolean; payoutId?: string }>("process-withdrawal", { amount })
}

export function listBankAccounts() {
  return invokeFunction<{ bankAccounts: BankAccountSummary[] }>("manage-bank-accounts", {
    action: "list",
  })
}

export function createBankAccountLink(returnUrl: string) {
  return invokeFunction<{ url: string }>("manage-bank-accounts", {
    action: "create_account_link",
    returnUrl,
    refreshUrl: `${returnUrl}#banking`,
  })
}

/**
 * Read the provider's Stripe Connect state straight from `providers` (RLS
 * scopes the row to its owner). The `check-verification-status` function has
 * no CORS headers, so the app reads the same fields via PostgREST instead.
 */
export async function fetchProviderStripeState(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProviderStripeState | null> {
  const { data } = await supabase
    .from("providers")
    .select(
      "stripe_account_id, stripe_onboarding_completed, charges_enabled, payouts_enabled, requirements_due, identity_verified, account_ready",
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (!data) return null

  const due = (data.requirements_due as string | null) ?? ""

  return {
    stripeAccountId: (data.stripe_account_id as string | null) ?? null,
    onboardingCompleted: Boolean(data.stripe_onboarding_completed),
    chargesEnabled: Boolean(data.charges_enabled),
    payoutsEnabled: Boolean(data.payouts_enabled),
    requirementsDue: due ? due.split(",").filter(Boolean) : [],
    identityVerified: Boolean(data.identity_verified),
    accountReady: Boolean(data.account_ready),
  }
}

export function startProviderVerification(returnUrl: string) {
  return invokeFunction<{ url: string; onboarding: boolean }>("create-verification-session", {
    return_url: returnUrl,
  })
}

/* -------------------------------------------------------------------------- */
/* Provider GDN card (Stripe Issuing)                                          */
/* -------------------------------------------------------------------------- */

export function requestProviderCard() {
  return invokeFunction<{ success: boolean; card?: { last4?: string } }>("request-provider-card", {
    terms_accepted: true,
    terms_acceptance_date: Math.floor(Date.now() / 1000),
  })
}

export function getProviderCard() {
  return invokeFunction<ProviderCardPayload>("get-card-details", {})
}

export function manageProviderCard(action: "block" | "unblock" | "report_lost" | "change_pin") {
  return invokeFunction<{ success: boolean; message?: string }>("manage-card", { action })
}

/* -------------------------------------------------------------------------- */
/* Portfolio                                                                   */
/* -------------------------------------------------------------------------- */

export function uploadPortfolioImage(file: File, title?: string, description?: string) {
  const form = new FormData()
  form.append("file", file)
  if (title) form.append("title", title)
  if (description) form.append("description", description)
  return invokeFunction<{ success: boolean; message?: string }>("upload-portfolio-image", form)
}

/* -------------------------------------------------------------------------- */
/* Support & welcome emails                                                    */
/* -------------------------------------------------------------------------- */

export function sendSupportMessage(input: { subject: string; message: string; role?: string }) {
  return invokeFunction<{ success: boolean }>("send-support-message", input)
}

export function sendWelcomeEmail(email: string, name: string, role: "client" | "provider") {
  return invokeFunction<{ success: boolean }>("send-welcome-email", { email, name, role })
}

/* -------------------------------------------------------------------------- */
/* Shop                                                                        */
/* -------------------------------------------------------------------------- */

export interface ShopCartItem {
  productId: string
  quantity: number
}

/**
 * Shop checkout. The caller must be signed in: the function reads the account
 * from the JWT it is given, so no id travels in the payload.
 */
export function createShopCheckout(input: {
  cartItems: ShopCartItem[]
  shippingInfo: Record<string, string>
}) {
  return invokeFunction<{ paymentIntent: string | null; paymentIntentId: string }>(
    "create-stripe-checkout",
    input,
  )
}
