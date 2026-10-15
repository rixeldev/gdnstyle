/**
 * Row shape for the live `appointments` table (see `docs/data.md`). Only the
 * columns the UI reads are listed; the database is the source of truth, so keep
 * these in sync with the Supabase project rather than inventing fields.
 */
export interface DbAppointment {
  id: string
  client_id: string | null
  provider_id: string
  location_id: string
  service_ids: string[]
  /** `YYYY-MM-DD`. */
  scheduled_date: string
  /** Postgres `time` (`HH:MM:SS`). */
  scheduled_time: string
  duration_minutes: number | null
  notes: string | null
  /** PostgREST returns `numeric` columns as strings. */
  price: number | string | null
  status: string | null
  created_at: string | null
  service_name: string | null
  client_name: string | null
  /** Stored as `numeric` in the database. */
  client_phone: number | string | null
  client_email: string | null
  cancelled_at: string | null
  /** Why the appointment was cancelled, filled in by whoever cancelled it. */
  cancellation_reason: string | null
  /**
   * Payment lifecycle: null/none (no charge) → pending (paid, awaiting the
   * professional's confirmation) → released (appointment confirmed) →
   * refunded. `paid` is the legacy value written by the payment-link webhook
   * and behaves like `released`.
   */
  payment_status: string | null
  refund_status: string | null
  refund_reason: string | null
}
