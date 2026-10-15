import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature")

  if (!signature) {
    return new Response("No signature", { status: 400 })
  }

  try {
    const body = await req.text()
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_APPOINTMENT")

    if (!webhookSecret) {
      throw new Error("Webhook secret no configurado")
    }

    // Verificar firma del webhook
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    )

    console.log("🎯 Webhook recibido:", event.type)

    // Solo procesar pagos completados
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session

      console.log("💳 Pago completado:", session.id)
      console.log("📦 Metadatos:", session.metadata)

      // Verificar que sea una cita
      if (session.metadata?.type !== "appointment") {
        console.log("⚠️ No es una cita, ignorando")
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      // Crear cliente de Supabase con service_role
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      )

      // Extraer datos de los metadatos
      const {
        provider_id,
        client_name,
        client_email,
        client_phone,
        service_id,
        scheduled_date,
        scheduled_time,
        notes,
        location_id,
      } = session.metadata

      console.log("💾 Creando cita en la base de datos...")

      // Crear la cita en la base de datos
      const { data: appointment, error: appointmentError } = await supabaseAdmin
        .from("appointments")
        .insert({
          provider_id,
          client_name,
          client_email,
          client_phone,
          service_ids: [service_id], // ✅ ARREGLADO: Ahora es un array
          scheduled_date,
          scheduled_time,
          notes: notes || null,
          location_id: location_id || null,
          status: "completed",
          payment_status: "paid",
          payment_id: session.payment_intent as string,
          stripe_session_id: session.id,
          amount_paid: session.amount_total ? session.amount_total / 100 : 0,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (appointmentError) {
        console.error("❌ Error al crear cita:", appointmentError)
        throw appointmentError
      }

      console.log("✅ Cita creada exitosamente:", appointment.id)

      return new Response(
        JSON.stringify({
          received: true,
          appointment_id: appointment.id,
        }),
        { status: 200 },
      )
    }

    // Otros eventos
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error: any) {
    console.error("❌ Error en webhook:", error)
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      { status: 400 },
    )
  }
})
