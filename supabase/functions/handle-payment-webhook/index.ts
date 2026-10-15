import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
})

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return new Response("No signature", { status: 400 })
  }

  try {
    const body = await req.text()
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")

    if (!webhookSecret) {
      console.error("⚠️ STRIPE_WEBHOOK_SECRET no configurado")
      return new Response("Webhook secret not configured", { status: 500 })
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)

    console.log("📨 Webhook recibido:", event.type, "ID:", event.id)

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent

      console.log("✅ Pago exitoso:", paymentIntent.id)
      console.log("💰 Monto:", paymentIntent.amount / 100)

      const metadata = paymentIntent.metadata
      const rawAppointmentId = metadata?.appointment_id
      const appointmentId =
        rawAppointmentId != null && String(rawAppointmentId).trim() !== ""
          ? String(rawAppointmentId).trim()
          : undefined

      const markAppointmentAsConfirmed = async () => {
        if (!appointmentId) return

        const { error: appointmentUpdateError } = await supabase
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("id", appointmentId)

        if (appointmentUpdateError) {
          console.error("⚠️ Error confirmando cita desde webhook:", appointmentUpdateError)
        } else {
          console.log("✅ Cita confirmada desde webhook:", appointmentId)
        }
      }

      // **VERIFICAR PRIMERO SI YA EXISTE UN REGISTRO PARA ESTE PAYMENT INTENT**
      const { data: existingPayment, error: checkError } = await supabase
        .from("provider_payments")
        .select("id, transfer_id, status")
        .eq("payment_intent_id", paymentIntent.id)
        .maybeSingle()

      if (checkError) {
        console.error("❌ Error verificando pago existente:", checkError)
      }

      if (existingPayment) {
        if (appointmentId) {
          const { error: patchDup } = await supabase
            .from("provider_payments")
            .update({ appointment_id: appointmentId })
            .eq("id", existingPayment.id)
          if (patchDup) {
            console.error("⚠️ Error rellenando appointment_id en pago duplicado:", patchDup)
          }
        }
        console.log("⚠️ PAGO YA PROCESADO - Ignorando webhook duplicado")
        console.log("   Payment Intent ID:", paymentIntent.id)
        console.log("   Registro existente ID:", existingPayment.id)
        console.log("   Transfer ID:", existingPayment.transfer_id)
        console.log("   Status:", existingPayment.status)
        await markAppointmentAsConfirmed()

        return new Response(
          JSON.stringify({
            received: true,
            message: "Payment already processed - duplicate webhook ignored",
            payment_id: existingPayment.id,
            transfer_id: existingPayment.transfer_id,
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        )
      }

      console.log("✅ Pago nuevo - Procesando...")
      const providerId = metadata.provider_id
      const serviceAmount = parseFloat(metadata.service_amount || "0")
      const platformFee = parseFloat(metadata.platform_fee || "0.50")

      console.log("📝 Procesando transferencia al proveedor...")
      console.log("   Proveedor ID:", providerId)
      console.log("   Monto servicio:", serviceAmount)
      console.log("   Comisión plataforma:", platformFee)

      // Obtener la cuenta de Stripe del proveedor
      const { data: provider, error: providerError } = await supabase
        .from("providers")
        .select("stripe_account_id")
        .eq("id", providerId)
        .single()

      if (providerError || !provider?.stripe_account_id) {
        console.error("❌ Error: Proveedor no tiene cuenta de Stripe conectada")

        // Guardar el registro sin transfer_id para procesarlo después
        const { error: insertError } = await supabase.from("provider_payments").insert({
          provider_id: providerId,
          payment_intent_id: paymentIntent.id,
          transfer_id: null,
          amount: serviceAmount,
          platform_fee: platformFee,
          status: "pending_transfer",
          ...(appointmentId ? { appointment_id: appointmentId } : {}),
        })

        if (insertError && insertError.code !== "23505") {
          console.error("❌ Error guardando registro pendiente:", insertError)
        }
        await markAppointmentAsConfirmed()

        return new Response(
          JSON.stringify({
            received: true,
            error: "Provider account not configured",
            saved_as_pending: true,
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        )
      }

      console.log("✅ Cuenta del proveedor:", provider.stripe_account_id)

      // Crear la transferencia al proveedor
      const serviceAmountCents = Math.round(serviceAmount * 100)

      console.log("💸 Creando transferencia...")
      console.log("   Monto en centavos:", serviceAmountCents)
      console.log("   Destino:", provider.stripe_account_id)

      const transfer = await stripe.transfers.create({
        amount: serviceAmountCents,
        currency: "usd",
        destination: provider.stripe_account_id,
        transfer_group: paymentIntent.id,
        description: `Pago por servicio - Payment Intent: ${paymentIntent.id}`,
      })

      console.log("✅ Transferencia creada:", transfer.id)
      console.log("💸 Transferencia completada")
      console.log(`   Proveedor recibió: $${serviceAmount}`)
      console.log(`   Plataforma retuvo: $${platformFee}`)

      // Guardar el registro en la base de datos
      const { data: insertedPayment, error: insertError } = await supabase
        .from("provider_payments")
        .insert({
          provider_id: providerId,
          payment_intent_id: paymentIntent.id,
          transfer_id: transfer.id,
          amount: serviceAmount,
          platform_fee: platformFee,
          status: "completed",
          ...(appointmentId ? { appointment_id: appointmentId } : {}),
        })
        .select()
        .single()

      if (insertError) {
        console.error("❌ Error guardando registro:", insertError)

        // Si es error de duplicado, es porque otro webhook ya lo procesó
        if (insertError.code === "23505") {
          console.log("⚠️ Registro duplicado detectado - Otro webhook ya procesó este pago")
          console.log(
            "⚠️ ADVERTENCIA: La transferencia ya fue creada pero el registro estaba duplicado",
          )
          console.log("   Transfer ID creado:", transfer.id)

          return new Response(
            JSON.stringify({
              received: true,
              message: "Duplicate prevented but transfer was created",
              transfer_id: transfer.id,
              warning: "Check for duplicate transfers in Stripe",
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            },
          )
        }

        throw insertError
      }

      console.log("✅ Registro guardado exitosamente")
      console.log("   Payment ID:", insertedPayment.id)
      console.log("   Transfer ID:", transfer.id)
      await markAppointmentAsConfirmed()

      return new Response(
        JSON.stringify({
          received: true,
          payment_id: insertedPayment.id,
          transfer_id: transfer.id,
          message: "Payment processed successfully",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      )
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    console.error("❌ Error en webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
})
