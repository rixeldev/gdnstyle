import type { SupabaseClient } from "@supabase/supabase-js"

import type { DbAppointment } from "@/interfaces/appointments"
import type { Booking } from "@/hooks/use-bookings"

const APPOINTMENT_COLUMNS =
  "id,client_id,provider_id,location_id,service_ids,scheduled_date,scheduled_time,duration_minutes,price,status,service_name,client_name,client_phone,client_email,created_at"

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
    database: true,
  }
}

/**
 * Insert a booking for the signed-in client. RLS only lets a client create
 * their own appointments, and the row comes back so the UI can show its id.
 */
export async function createAppointment(
  client: SupabaseClient,
  input: NewAppointment,
): Promise<DbAppointment | null> {
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
    console.error("[appointments] failed to create the appointment", error)
    return null
  }

  return data as DbAppointment
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
    console.error("[appointments] failed to load the appointments", error)
    return []
  }

  return (data ?? []) as DbAppointment[]
}

/** Delete one of the client's own appointments. */
export async function cancelAppointment(client: SupabaseClient, id: string): Promise<boolean> {
  const { error } = await client.from("appointments").delete().eq("id", id)
  if (error) {
    console.error("[appointments] failed to cancel the appointment", error)
    return false
  }
  return true
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
    console.error("[appointments] failed to load the provider appointments", error)
    return []
  }

  return (data ?? []) as DbAppointment[]
}

/** Move an appointment to a new status (the provider confirms/completes it). */
export async function setAppointmentStatus(
  client: SupabaseClient,
  id: string,
  status: string,
): Promise<boolean> {
  const { error } = await client.from("appointments").update({ status }).eq("id", id)

  if (error) {
    console.error("[appointments] failed to update the appointment", error)
    return false
  }

  return true
}
