import type { SupabaseClient } from "@supabase/supabase-js"

import type { DbAppointment } from "@/interfaces/appointments"
import type { Booking } from "@/hooks/use-bookings"
import { canClientModify } from "@/utils/appointment-status"

const APPOINTMENT_COLUMNS_BASE =
  "id,client_id,provider_id,location_id,service_ids,scheduled_date,scheduled_time,duration_minutes,price,status,service_name,client_name,client_phone,client_email,created_at"
// `cancelled_at`/`cancellation_reason` come with the cancellation flow and the
// payment lifecycle columns come after migration 0003; before those exist the
// select falls back to the base list so nothing breaks mid-deploy.
const APPOINTMENT_COLUMNS = `${APPOINTMENT_COLUMNS_BASE},cancelled_at,cancellation_reason,payment_status,refund_status,refund_reason`

/** True when Postgres rejected the query for an unknown column (42703). */
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703"
}

/**
 * True when Postgres refused the write because the hour already overlapped
 * (23P01, the no-overlap constraint from migration 0010).
 */
function isSlotConflict(error: { code?: string } | null): boolean {
  return error?.code === "23P01"
}

/** Everything needed to create an `appointments` row for the signed-in client. */
export interface NewAppointment {
  clientId: string
  providerId: string
  locationId: string
  serviceId: string
  serviceName: string | null
  /** `YYYY-MM-DD`. */
  date: string
  /** `HH:MM`. */
  time: string
  durationMinutes: number
  price: number
  clientName: string | null
  clientEmail: string | null
  clientPhone: number | null
}

/** Postgres `time` (`HH:MM:SS`) → the `HH:MM` used across the booking UI. */
function toHhMm(value: string | null | undefined): string {
  return (value ?? "").slice(0, 5)
}

/**
 * The IANA zone each professional writes their hours in, read from the
 * `provider_public` view (migration 0013). Browsers classify a booking —
 * overdue, countdown, the 1h30m lock — against this clock, the same one the
 * database compares it to. An empty map is a valid answer: databases without
 * the view (or the column) simply keep the browser-local reading they had.
 */
export async function fetchProviderTimeZones(
  client: SupabaseClient,
  providerIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(providerIds.filter(Boolean))]
  if (ids.length === 0) return {}

  const { data, error } = await client.from("provider_public").select("id,timezone").in("id", ids)

  if (error) {
    // Migration 0013 not applied yet: fall back to the browser's own clock.
    if (error.code !== "PGRST204" && error.code !== "42703") {
      console.error("[providers] failed to load the provider time zones", error)
    }
    return {}
  }

  const zones: Record<string, string> = {}
  for (const row of (data ?? []) as Array<{ id: string; timezone: string | null }>) {
    if (row.timezone) zones[row.id] = row.timezone
  }
  return zones
}

/** Merge the fetched zones onto the rows so `appointmentToBooking` can read them. */
function withProviderTimeZones(
  rows: DbAppointment[],
  zones: Record<string, string>,
): DbAppointment[] {
  return rows.map((row) => ({
    ...row,
    ...(zones[row.provider_id] ? { provider_timezone: zones[row.provider_id] } : {}),
  }))
}

/** `HH:MM` → minutes since midnight (used by the overlap check). */
function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

/**
 * An interval that is already booked on a day. Cancelled appointments free
 * their slot; every other status (pending, confirmed, completed) blocks it.
 */
export interface OccupiedSlot {
  /** `HH:MM`. */
  time: string
  durationMinutes: number
}

/**
 * Times already booked for one professional on one day, read through the
 * `occupied_appointment_slots` RPC (migration 0011). The RPC returns only the
 * two columns the grid needs: the direct table read this replaces let every
 * signed-in visitor see every booking's client name, email and notes.
 */
export async function fetchOccupiedSlots(
  client: SupabaseClient,
  input: {
    providerId?: string | null
    date: string
    /** Appointment being moved: its own slot must not block the new one. */
    excludeId?: string | null
  },
): Promise<OccupiedSlot[]> {
  const map = (rows: Array<{ scheduled_time: string; duration_minutes: number | null }>) =>
    rows.map((row) => ({
      time: toHhMm(row.scheduled_time),
      durationMinutes: Number(row.duration_minutes) || 30,
    }))

  if (input.providerId) {
    const { data, error } = await client.rpc("occupied_appointment_slots", {
      p_provider_id: input.providerId,
      p_date: input.date,
      p_exclude_id: input.excludeId ?? null,
    })

    if (!error) return map(data ?? [])

    // The RPC ships with migration 0011. Databases that do not have it yet
    // still allow the old direct read, so the grid stays correct on both
    // sides of the deploy; other failures fall through to it as well.
    if (error.code !== "PGRST202" && error.code !== "42883") {
      console.error("[appointments] failed to load the occupied slots", error)
    }
  }

  let query = client
    .from("appointments")
    .select("scheduled_time, duration_minutes")
    .eq("scheduled_date", input.date)
    .neq("status", "cancelled")

  if (input.providerId) query = query.eq("provider_id", input.providerId)
  if (input.excludeId) query = query.neq("id", input.excludeId)

  const { data, error } = await query

  if (error) {
    console.error("[appointments] failed to load the occupied slots", error)
    return []
  }

  return map(data ?? [])
}

/**
 * True when `[start, start + duration)` collides with nothing already booked.
 *
 * The same rule backs the slot grid, the insert below and the
 * `create-appointment` Edge Function, so a taken hour can never be booked
 * twice — not even when two visitors race for it.
 */
export function slotIsFree(
  occupied: OccupiedSlot[],
  time: string,
  durationMinutes: number,
): boolean {
  const start = minutesOfDay(time)
  const end = start + Math.max(1, durationMinutes)

  return occupied.every((slot) => {
    const slotStart = minutesOfDay(slot.time)
    const slotEnd = slotStart + Math.max(1, slot.durationMinutes)
    return end <= slotStart || start >= slotEnd
  })
}

/** Thrown when the requested hour is already taken by another appointment. */
export class SlotUnavailableError extends Error {
  constructor(reason: "slot-taken" | "outside-hours" = "slot-taken") {
    super(reason)
    this.name = "SlotUnavailableError"
  }
}

/** Thrown when a client tries to change an appointment inside the lock window. */
export class ChangeWindowClosedError extends Error {
  constructor() {
    super("change-window-closed")
    this.name = "ChangeWindowClosedError"
  }
}

/** Map a database row onto the client-side booking shape used by the UI. */
export function appointmentToBooking(row: DbAppointment): Booking {
  return {
    id: row.id,
    venueId: row.location_id,
    serviceId: row.service_ids?.[0] ?? "",
    professionalId: row.provider_id,
    date: row.scheduled_date,
    time: toHhMm(row.scheduled_time),
    price: Number(row.price) || 0,
    createdAt: row.created_at ? Date.parse(row.created_at) : 0,
    serviceName: row.service_name?.trim() || undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    status: row.status ?? undefined,
    clientName: row.client_name ?? undefined,
    clientPhone: row.client_phone == null ? undefined : String(row.client_phone),
    clientEmail: row.client_email ?? undefined,
    paymentStatus: row.payment_status ?? undefined,
    refundStatus: row.refund_status ?? undefined,
    refundReason: row.refund_reason ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
    // Only set when the service merged a zone onto the row, so a merge over an
    // existing booking keeps the zone it already had.
    ...(row.provider_timezone ? { timeZone: row.provider_timezone } : {}),
    database: true,
  }
}

/**
 * Insert a booking for the signed-in client. RLS only lets a client create
 * their own appointments, and the row comes back so the UI can show its id.
 *
 * The hour is validated against the provider's existing appointments first, so
 * a slot that filled up while the form was open fails fast (throws
 * `SlotUnavailableError`) instead of double booking. The `create-appointment`
 * Edge Function re-runs the same rule server-side for the paid path.
 */
export async function createAppointment(
  client: SupabaseClient,
  input: NewAppointment,
): Promise<DbAppointment | null> {
  const occupied = await fetchOccupiedSlots(client, {
    providerId: input.providerId,
    date: input.date,
  })
  if (!slotIsFree(occupied, input.time, input.durationMinutes)) {
    throw new SlotUnavailableError()
  }

  const { data, error } = await client
    .from("appointments")
    .insert({
      client_id: input.clientId,
      provider_id: input.providerId,
      location_id: input.locationId,
      service_ids: [input.serviceId],
      scheduled_date: input.date,
      scheduled_time: input.time,
      duration_minutes: input.durationMinutes,
      price: input.price,
      service_name: input.serviceName,
      client_name: input.clientName,
      client_email: input.clientEmail,
      client_phone: input.clientPhone,
    })
    .select(APPOINTMENT_COLUMNS)
    .single()

  if (error) {
    // The no-overlap constraint (migration 0010) is the last line of defence:
    // if two visitors raced for the hour, the loser is told it is taken.
    if (isSlotConflict(error)) throw new SlotUnavailableError()
    console.error("[appointments] failed to create the appointment", error)
    return null
  }

  return (await mergeTimeZones(client, [data as DbAppointment]))[0]
}

/** Everything needed to move an existing appointment to a new day/time. */
export interface RescheduleInput {
  id: string
  providerId?: string | null
  /** Slot the appointment has now: it decides whether the lock is still open. */
  currentDate: string
  currentTime: string
  /** Slot the client picked instead. */
  date: string
  time: string
  durationMinutes: number
  /** The provider's zone, so the pre-check below uses the venue's clock. */
  timeZone?: string | null
}

/**
 * Move one of the client's appointments from the dashboard.
 *
 * Two rules run before the write:
 *  1. the 1h30m lock window must still be open (`ChangeWindowClosedError`);
 *  2. the new hour must be free, excluding the appointment's own current slot
 *     so re-picking it is a no-op instead of a conflict
 *     (`SlotUnavailableError` when someone else took the hour meanwhile).
 */
export async function rescheduleAppointment(
  client: SupabaseClient,
  input: RescheduleInput,
): Promise<DbAppointment | null> {
  if (
    !canClientModify(
      { date: input.currentDate, time: input.currentTime, timeZone: input.timeZone },
      Date.now(),
    )
  ) {
    throw new ChangeWindowClosedError()
  }

  const occupied = await fetchOccupiedSlots(client, {
    providerId: input.providerId,
    date: input.date,
    excludeId: input.id,
  })
  if (!slotIsFree(occupied, input.time, input.durationMinutes)) {
    throw new SlotUnavailableError()
  }

  const { data, error } = await client
    .from("appointments")
    .update({ scheduled_date: input.date, scheduled_time: input.time })
    .eq("id", input.id)
    .select(APPOINTMENT_COLUMNS)
    .single()

  if (error) {
    // Same lock as the insert: moving onto an hour that filled up meanwhile
    // surfaces as a conflict, not as a silent failure.
    if (isSlotConflict(error)) throw new SlotUnavailableError()
    console.error("[appointments] failed to move the appointment", error)
    return null
  }

  return (await mergeTimeZones(client, [data as DbAppointment]))[0]
}

/** The signed-in client's appointments (RLS scopes the select to the owner). */
export async function fetchClientAppointments(
  client: SupabaseClient,
  clientId: string,
): Promise<DbAppointment[]> {
  const { data, error } = await client
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("client_id", clientId)
    .order("scheduled_date", { ascending: false })

  if (error) {
    // Migration 0003 not applied yet: retry with the base columns only.
    if (isMissingColumn(error)) {
      const fallback = await client
        .from("appointments")
        .select(APPOINTMENT_COLUMNS_BASE)
        .eq("client_id", clientId)
        .order("scheduled_date", { ascending: false })
      if (!fallback.error)
        return await mergeTimeZones(client, (fallback.data ?? []) as DbAppointment[])
    }
    console.error("[appointments] failed to load the appointments", error)
    return []
  }

  return await mergeTimeZones(client, (data ?? []) as DbAppointment[])
}

/** Stamp each row with its provider's zone so the UI runs on the venue clock. */
async function mergeTimeZones(
  client: SupabaseClient,
  rows: DbAppointment[],
): Promise<DbAppointment[]> {
  const zones = await fetchProviderTimeZones(
    client,
    rows.map((row) => row.provider_id),
  )
  return withProviderTimeZones(rows, zones)
}

/** Appointments booked with one provider (RLS scopes the select to its owner). */
export async function fetchProviderAppointments(
  client: SupabaseClient,
  providerId: string,
): Promise<DbAppointment[]> {
  const { data, error } = await client
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("provider_id", providerId)
    .order("scheduled_date", { ascending: false })

  if (error) {
    if (isMissingColumn(error)) {
      const fallback = await client
        .from("appointments")
        .select(APPOINTMENT_COLUMNS_BASE)
        .eq("provider_id", providerId)
        .order("scheduled_date", { ascending: false })
      if (!fallback.error)
        return await mergeTimeZones(client, (fallback.data ?? []) as DbAppointment[])
    }
    console.error("[appointments] failed to load the provider appointments", error)
    return []
  }

  return await mergeTimeZones(client, (data ?? []) as DbAppointment[])
}

/** Result of a client-side cancellation, used to pick the toast message. */
export type CancellationOutcome = "refund-requested" | "cancelled" | "too-late" | null

const REFUNDABLE_STATUSES = new Set(["pending", "released", "paid"])

/**
 * Client cancels one of their appointments. Paid appointments are not
 * deleted: the row moves to `cancelled` and a refund request is opened for
 * the professional to approve (payment stays pending/released until then).
 *
 * The 1h30m lock window is closed on both sides: the slot is read up front so
 * a normal visit never reaches the write, and the RPC refuses on its own with
 * SQLSTATE GDN90 for everything else (wrong clock, modified client). A direct
 * update remains as a fallback for databases whose RLS still allows it.
 */
export async function requestAppointmentCancellation(
  client: SupabaseClient,
  id: string,
  reason?: string,
): Promise<CancellationOutcome> {
  const value = reason?.trim() || null

  // Inside the 1h30m lock window the client can no longer cancel, so read the
  // slot before the RPC: cancelling first and undoing afterwards is not an
  // option, and showing the right message beats surfacing a database error.
  const { data: slot, error: slotError } = await client
    .from("appointments")
    .select("scheduled_date, scheduled_time, provider_id")
    .eq("id", id)
    .maybeSingle()

  if (slotError) {
    console.error("[appointments] failed to read the appointment slot", slotError)
    return null
  }
  if (slot) {
    // Same clock as the RPC below: the venue's own zone, not the browser's.
    const zones = await fetchProviderTimeZones(client, [slot.provider_id])
    const timeZone = zones[slot.provider_id]
    if (
      !canClientModify(
        { date: slot.scheduled_date, time: toHhMm(slot.scheduled_time), timeZone },
        Date.now(),
      )
    ) {
      return "too-late"
    }
  }

  // The reason is persisted in `cancellation_reason` so the professional can
  // see why the client backed out. Databases still running the older RPC
  // (migration 0003, no reason parameter) reject the extra argument with a
  // function-not-found error, so retry once with the original signature.
  const { data: rpcOutcome, error: rpcError } = await client.rpc(
    "request_appointment_cancellation",
    value ? { p_id: id, p_reason: value } : { p_id: id },
  )

  // The database closed the window itself (migration 0011): no fallback write
  // may try to undo that answer.
  if (rpcError && rpcError.code === "GDN90") {
    return "too-late"
  }

  if (rpcError && value) {
    const { data: legacyOutcome, error: legacyError } = await client.rpc(
      "request_appointment_cancellation",
      { p_id: id },
    )
    if (!legacyError && (legacyOutcome === "refund-requested" || legacyOutcome === "cancelled")) {
      // The row is already cancelled; only the reason is still missing.
      await persistCancellationReason(client, id, value)
      return legacyOutcome as Exclude<CancellationOutcome, null>
    }
  }
  if (!rpcError && (rpcOutcome === "refund-requested" || rpcOutcome === "cancelled")) {
    return rpcOutcome as Exclude<CancellationOutcome, null>
  }

  // Fallback: direct update (works when RLS already lets a client touch it).
  const { data: row, error: readError } = await client
    .from("appointments")
    .select("payment_status, refund_status")
    .eq("id", id)
    .maybeSingle()

  if (readError && !isMissingColumn(readError)) {
    console.error("[appointments] failed to read the appointment before cancelling", readError)
    return null
  }

  const paymentStatus = (row?.payment_status ?? "").toLowerCase()
  const refundStatus = (row?.refund_status ?? "").toLowerCase()
  const now = new Date().toISOString()
  const reasonValue = reason?.trim() || null

  // Paid money already captured → keep history and open a refund request.
  if (REFUNDABLE_STATUSES.has(paymentStatus) && refundStatus !== "approved") {
    const { data: updated, error } = await client
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: reasonValue,
        refund_status: "requested",
        refund_requested_at: now,
      })
      .eq("id", id)
      .select("id")

    if (!error) {
      // RLS hides the row instead of failing once the window closes
      // (migration 0011): nothing matched means the change was refused.
      if (updated?.length) return "refund-requested"
      return "too-late"
    }
    // Migration 0003 missing: fall through to a plain status cancel.
    if (!isMissingColumn(error)) {
      console.error("[appointments] failed to cancel the paid appointment", error)
      return null
    }
  }

  const { data: updated, error } = await client
    .from("appointments")
    .update({ status: "cancelled", cancelled_at: now, cancellation_reason: reasonValue })
    .eq("id", id)
    .select("id")

  if (error) {
    console.error("[appointments] failed to cancel the appointment", error)
    return null
  }
  if (!updated?.length) return "too-late"

  return "cancelled"
}

/**
 * Best-effort write of `cancellation_reason` for databases whose RPC predates
 * the reason parameter: the row is already cancelled, so a missing column must
 * never surface as an error.
 */
async function persistCancellationReason(
  client: SupabaseClient,
  id: string,
  reason: string | null,
): Promise<void> {
  const value = reason?.trim()
  if (!value) return

  const { error } = await client
    .from("appointments")
    .update({ cancellation_reason: value })
    .eq("id", id)

  if (error && !isMissingColumn(error)) {
    console.error("[appointments] failed to store the cancellation reason", error)
  }
}

/**
 * Professional cancels a booking. Same terminal state as the client's own
 * cancellation, but without opening a refund request (the provider side is the
 * one that would approve it) and always storing who cancelled it and why.
 */
export async function cancelAppointmentByProvider(
  client: SupabaseClient,
  id: string,
  reason?: string,
): Promise<boolean> {
  const { error } = await client
    .from("appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason?.trim() || null,
    })
    .eq("id", id)

  if (error) {
    if (isMissingColumn(error)) {
      // Older database without `cancellation_reason`: still cancel the row.
      const { error: retryError } = await client
        .from("appointments")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", id)
      if (!retryError) return true
      console.error("[appointments] failed to cancel the appointment", retryError)
      return false
    }
    console.error("[appointments] failed to cancel the appointment", error)
    return false
  }

  return true
}

/**
 * Professional confirms a booking: the appointment moves to `confirmed` and
 * a pending payment is released (shown to the client as completed).
 *
 * Preferred path is the `confirm_appointment` RPC (migration 0003); the
 * direct update below is the fallback when the RPC does not exist yet.
 */
export async function confirmAppointment(
  client: SupabaseClient,
  id: string,
): Promise<DbAppointment | null> {
  const { error: rpcError } = await client.rpc("confirm_appointment", { p_id: id })

  if (rpcError) {
    const { data: row } = await client
      .from("appointments")
      .select("payment_status")
      .eq("id", id)
      .maybeSingle()

    const paymentStatus = (row?.payment_status ?? "").toLowerCase()
    const patch: Record<string, string> = { status: "confirmed" }
    if (paymentStatus === "pending") patch.payment_status = "released"

    const { error } = await client.from("appointments").update(patch).eq("id", id).select("id")

    if (error && isMissingColumn(error)) {
      // Migration 0003 missing: retry without the payment column.
      const retry = await client
        .from("appointments")
        .update({ status: "confirmed" })
        .eq("id", id)
        .select("id")
      if (retry.error) {
        console.error("[appointments] failed to confirm the appointment", retry.error)
        return null
      }
    } else if (error) {
      console.error("[appointments] failed to confirm the appointment", error)
      return null
    }
  }

  // Read the refreshed row back (same column fallback as the list fetches).
  const { data, error } = await client
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle()

  if (data) return data as DbAppointment

  if (isMissingColumn(error)) {
    const fallback = await client
      .from("appointments")
      .select(APPOINTMENT_COLUMNS_BASE)
      .eq("id", id)
      .maybeSingle()
    if (fallback.data) return fallback.data as DbAppointment
  }

  console.error("[appointments] failed to read the confirmed appointment", error)
  return null
}

/** Professional rejects a refund request; the payment stays with them. */
export async function rejectRefundRequest(client: SupabaseClient, id: string): Promise<boolean> {
  const { error } = await client
    .from("appointments")
    .update({ refund_status: "rejected", refund_resolved_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("[appointments] failed to reject the refund request", error)
    return false
  }

  return true
}
