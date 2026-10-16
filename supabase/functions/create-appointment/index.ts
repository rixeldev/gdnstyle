import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"

/**
 * Guarda el UUID de appointments.id en provider_payments.appointment_id.
 * El webhook puede insertar la fila unos ms después del pago: primer intento al instante,
 * luego reintentos cortos (sin tocar la respuesta de la API si falla el enlace).
 */
async function linkAppointmentToProviderPayment(
  supabase: SupabaseClient,
  paymentIntentId: string,
  appointmentUuid: string,
): Promise<void> {
  const maxAttempts = 12
  const delayMs = 400

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, delayMs))
    }

    const { data, error } = await supabase
      .from("provider_payments")
      .update({ appointment_id: appointmentUuid })
      .eq("payment_intent_id", paymentIntentId)
      .select("id")

    if (error) {
      console.error("⚠️ Error enlazando provider_payments:", error)
      return
    }
    if (data && data.length > 0) {
      console.log(
        "✅ provider_payments.appointment_id =",
        appointmentUuid,
        "payment_intent_id =",
        paymentIntentId,
        "intento",
        i + 1,
      )
      return
    }
  }

  console.error(
    "⚠️ No se encontró provider_payments para payment_intent_id tras reintentos:",
    paymentIntentId,
  )
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/**
 * Fallo con causa conocida. El frontend la traduce por `code`, en vez de
 * mostrar el texto de aquí — que sale en español a una interfaz en inglés.
 */
class FunctionFailure extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "FunctionFailure"
    this.code = code
  }
}

/**
 * Fixed-window budget for this function's calls, backed by the
 * `consume_rate_limit` RPC (migration 0008). Inlined per function on purpose:
 * the deploy bundles a single folder, so a shared module never reaches the
 * platform. Fails open — until that migration exists, or if the database
 * blips, the request goes through, because refusing a payment is a worse
 * outcome than a short burst of calls.
 */
async function underRateLimit(
  supabase: ReturnType<typeof createClient>,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.warn(`[rate-limit] ${error.message} — continuing without a limit for ${key}`)
      return true
    }

    return data !== false
  } catch (cause) {
    console.warn(`[rate-limit] ${String(cause)} — continuing without a limit for ${key}`)
    return true
  }
}

/** `HH:MM` o `HH:MM:SS` → minutos desde medianoche. */
function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

/**
 * Regla de disponibilidad compartida con el cliente (`buildDaySlots`):
 * una cita ocupa su propia duración, así que un servicio de 45 min a las
 * 9:00 bloquea también las 9:30. Solo se compara contra citas que no están
 * canceladas, de modo que liberar una cita libera su hueco.
 */
function slotIsFree(
  occupied: Array<{ scheduled_time: string; duration_minutes: number | null }>,
  time: string,
  durationMinutes: number,
): boolean {
  const start = toMinutes(time)
  const end = start + Math.max(1, durationMinutes || 30)

  return occupied.every((row) => {
    const rowStart = toMinutes(row.scheduled_time)
    const rowEnd = rowStart + Math.max(1, row.duration_minutes || 30)
    return end <= rowStart || start >= rowEnd
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Inicializar Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Obtener el token del usuario
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("No authorization header")
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error("Usuario no autenticado")
    }

    // Cada llamada consulta y cobra un intent de pago en Stripe y escribe una
    // fila: un puñado por usuario y ventana cubre cualquier reserva real.
    if (!(await underRateLimit(supabase, `appointment:${user.id}`, 20, 600))) {
      throw new FunctionFailure("RATE_LIMITED", "Demasiadas solicitudes de reserva")
    }

    const {
      paymentIntentId,
      paymentMethod: paymentMethodRaw,
      serviceId,
      serviceName,
      providerId,
      locationId,
      scheduledDate,
      scheduledTime,
      durationMinutes,
      notes,
    } = await req.json()
    const paymentMethod = paymentMethodRaw === "in_person" ? "in_person" : "stripe"

    // Validar datos requeridos
    if (!serviceId || !providerId || !scheduledDate || !scheduledTime) {
      throw new Error("Faltan datos requeridos")
    }
    if (paymentMethod === "stripe" && !paymentIntentId) {
      throw new Error("paymentIntentId es requerido para pagos con tarjeta")
    }

    // Precio y duración los decide `provider_services`, no el cliente: los
    // campos `price` y `durationMinutes` que manda el formulario se ignoran,
    // así una llamada modificada no puede registrar un importe distinto al
    // que se cobró (ni alargar un servicio para bloquear más horas ajenas).
    const { data: serviceRow, error: serviceError } = await supabase
      .from("provider_services")
      .select("id, provider_id, name, price, duration, is_active")
      .eq("id", serviceId)
      .maybeSingle()

    if (serviceError || !serviceRow || serviceRow.is_active === false) {
      console.error("❌ Servicio inexistente o inactivo:", serviceId, serviceError)
      throw new FunctionFailure("SERVICE_NOT_FOUND", "El servicio no existe o no está activo")
    }

    if (serviceRow.provider_id !== providerId) {
      throw new FunctionFailure("PROVIDER_MISMATCH", "El servicio no pertenece a este proveedor")
    }

    const servicePrice = Number(serviceRow.price) || 0
    const serviceDuration = Number(serviceRow.duration) || Number(durationMinutes) || 30

    console.log("📝 Creando cita para:", {
      client_id: user.id,
      provider_id: providerId,
      service_id: serviceId,
      service_name: serviceName,
      date: scheduledDate,
      time: scheduledTime,
      payment_method: paymentMethod,
    })

    let canonicalPaymentIntentId: string | null = null
    if (paymentMethod === "stripe") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
      if (!stripeKey) {
        throw new Error("Stripe secret key not configured")
      }

      const stripe = new Stripe(stripeKey, {
        apiVersion: "2023-10-16",
      })

      // Verificar que el pago fue exitoso
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

      if (paymentIntent.status !== "succeeded") {
        throw new Error("El pago no ha sido completado exitosamente")
      }

      console.log("✅ Pago verificado:", paymentIntent.id)
      canonicalPaymentIntentId = paymentIntent.id
    }

    // El nombre que viaja en la cita sale de la fila del servicio: el
    // formulario ya lo lee de ahí, pero no es la fuente de verdad.
    const finalServiceName = serviceRow.name || serviceName || "Servicio"

    // Obtener el nombre del cliente desde la tabla profiles
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single()

    const clientName = clientProfile?.full_name || "Cliente"

    console.log("👤 Nombre del cliente:", clientName)

    if (paymentMethod === "stripe" && canonicalPaymentIntentId) {
      // **VERIFICAR PRIMERO SI YA EXISTE UNA CITA PARA ESTE PAYMENT INTENT ID**
      // Esto previene duplicados si se llama la función múltiples veces
      // Buscar en provider_payments si ya existe un registro con este payment_intent_id
      const { data: existingPayment, error: paymentCheckError } = await supabase
        .from("provider_payments")
        .select("appointment_id, payment_intent_id")
        .eq("payment_intent_id", canonicalPaymentIntentId)
        .maybeSingle()

      if (paymentCheckError) {
        console.error("⚠️ Error verificando pago existente:", paymentCheckError)
      }

      // Si ya existe un registro de pago con este payment_intent_id y tiene appointment_id
      if (existingPayment && existingPayment.appointment_id) {
        console.log("⚠️ CITA YA CREADA PARA ESTE PAGO - Retornando cita existente")
        console.log("   Payment Intent ID:", paymentIntentId)
        console.log("   Appointment ID existente:", existingPayment.appointment_id)

        // Obtener información completa de la cita existente
        const { data: fullAppointment, error: fetchError } = await supabase
          .from("appointments")
          .select(
            `
            *,
            client:profiles!appointments_client_id_fkey(full_name, email, phone),
            provider:providers!appointments_provider_id_fkey(full_name, email, phone),
            location:locations!appointments_location_id_fkey(name, address, city, state)
          `,
          )
          .eq("id", existingPayment.appointment_id)
          .single()

        if (fetchError) {
          console.error("⚠️ Error obteniendo detalles de la cita existente:", fetchError)
        }

        return new Response(
          JSON.stringify({
            success: true,
            appointment: fullAppointment,
            message: "Cita ya existente (duplicado prevenido)",
            isDuplicate: true,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        )
      }
    }

    // También verificar si existe una cita con los mismos datos (client, provider, fecha, hora)
    // Esto es una segunda capa de protección
    const { data: existingAppointment, error: checkError } = await supabase
      .from("appointments")
      .select("id, client_id, provider_id, scheduled_date, scheduled_time")
      .eq("client_id", user.id)
      .eq("provider_id", providerId)
      .eq("scheduled_date", scheduledDate)
      .eq("scheduled_time", scheduledTime)
      .maybeSingle()

    if (checkError) {
      console.error("⚠️ Error verificando cita existente:", checkError)
    }

    if (existingAppointment) {
      console.log("⚠️ CITA CON MISMOS DATOS YA EXISTE - Retornando cita existente")
      console.log("   Cita existente ID:", existingAppointment.id)

      if (paymentMethod === "stripe" && canonicalPaymentIntentId) {
        await linkAppointmentToProviderPayment(
          supabase,
          canonicalPaymentIntentId,
          existingAppointment.id,
        )
      }

      // Obtener información completa de la cita existente
      const { data: fullAppointment, error: fetchError } = await supabase
        .from("appointments")
        .select(
          `
          *,
          client:profiles!appointments_client_id_fkey(full_name, email, phone),
          provider:providers!appointments_provider_id_fkey(full_name, email, phone),
          location:locations!appointments_location_id_fkey(name, address, city, state)
        `,
        )
        .eq("id", existingAppointment.id)
        .single()

      if (fetchError) {
        console.error("⚠️ Error obteniendo detalles de la cita existente:", fetchError)
      }

      return new Response(
        JSON.stringify({
          success: true,
          appointment: fullAppointment || existingAppointment,
          message: "Cita ya existente (duplicado prevenido)",
          isDuplicate: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      )
    }

    // **VALIDAR QUE LA HORA SIGA LIBRE**: el formulario puede estar desactualizado
    // (dos clientes a la vez) y el pago ya ocurrió, así que esta comprobación
    // es la autoritativa. Responde 409 con `code: SLOT_TAKEN` para que el
    // frontend muestre su propio mensaje localizado.
    const slotDuration = serviceDuration
    const { data: occupiedRows, error: occupiedError } = await supabase
      .from("appointments")
      .select("scheduled_time, duration_minutes")
      .eq("provider_id", providerId)
      .eq("scheduled_date", scheduledDate)
      .neq("status", "cancelled")

    if (occupiedError) {
      console.error("⚠️ Error verificando disponibilidad:", occupiedError)
    }

    if (!slotIsFree(occupiedRows ?? [], scheduledTime, slotDuration)) {
      console.log("⚠️ HORA OCUPADA:", scheduledDate, scheduledTime, "provider:", providerId)
      return new Response(
        JSON.stringify({
          success: false,
          code: "SLOT_TAKEN",
          error: "La hora seleccionada ya está reservada",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        },
      )
    }

    // Crear la cita en la base de datos
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        client_id: user.id,
        provider_id: providerId,
        location_id: locationId,
        service_ids: [serviceId],
        service_name: finalServiceName || "Servicio",
        client_name: clientName,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        duration_minutes: serviceDuration,
        price: servicePrice,
        notes: notes || null,
        status: "pending",
        payment_method: paymentMethod,
      })
      .select()
      .single()

    if (appointmentError) {
      console.error("❌ Error creando cita:", appointmentError)
      throw new Error("Error al crear la cita: " + appointmentError.message)
    }

    console.log("✅ Cita creada exitosamente:", appointment.id)

    if (paymentMethod === "stripe" && canonicalPaymentIntentId) {
      await linkAppointmentToProviderPayment(supabase, canonicalPaymentIntentId, appointment.id)
    }

    // Obtener información completa de la cita para retornar
    const { data: fullAppointment, error: fetchError } = await supabase
      .from("appointments")
      .select(
        `
        *,
        client:profiles!appointments_client_id_fkey(full_name, email, phone),
        provider:providers!appointments_provider_id_fkey(full_name, email, phone),
        location:locations!appointments_location_id_fkey(name, address, city, state)
      `,
      )
      .eq("id", appointment.id)
      .single()

    if (fetchError) {
      console.error("⚠️ Error obteniendo detalles de la cita:", fetchError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        appointment: fullAppointment || appointment,
        message: "Cita creada exitosamente",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("❌ Error en create-appointment:", error)
    // `code` is what the frontend translates; the message stays for the logs.
    const code = error instanceof FunctionFailure ? { code: error.code } : null
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        ...code,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    )
  }
})
