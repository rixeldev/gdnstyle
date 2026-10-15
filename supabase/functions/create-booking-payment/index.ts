import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured")
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    })

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Obtener el token de autorización
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("No authorization header")
    }

    // Verificar el usuario autenticado
    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error("Unauthorized")
    }

    const {
      amount,
      currency = "usd",
      metadata,
      providerId,
      paymentMethodId,
      appointmentData,
    } = await req.json()

    if (!amount || amount <= 0) {
      throw new Error("Invalid amount")
    }

    if (!providerId) {
      throw new Error("Provider ID is required")
    }

    // Obtener el stripe_account_id del proveedor
    const { data: providerData, error: providerError } = await supabase
      .from("providers")
      .select("stripe_account_id")
      .eq("id", providerId)
      .single()

    if (providerError || !providerData) {
      throw new Error("Provider not found")
    }

    if (!providerData.stripe_account_id) {
      throw new Error("Provider does not have a Stripe account configured")
    }

    // Calcular montos
    const serviceAmount = amount
    const platformFee = 0.5
    const targetNet = serviceAmount + platformFee
    const totalAmount = (targetNet + 0.3) / (1 - 0.029)
    const stripeTotalFee = totalAmount - targetNet
    const totalAmountCents = Math.round(totalAmount * 100)

    console.log("💰 Desglose de pago:")
    console.log(`   Cliente paga: $${totalAmount.toFixed(2)}`)
    console.log(`   Stripe cobra: $${stripeTotalFee.toFixed(2)}`)
    console.log(`   Neto después de Stripe: $${targetNet.toFixed(2)}`)
    console.log(`   Servicio (proveedor): $${serviceAmount.toFixed(2)}`)
    console.log(`   Plataforma: $${platformFee.toFixed(2)}`)

    let pendingAppointmentId: string | null = null

    // Si el proveedor está generando un enlace de pago, crear la cita en estado pending
    if (appointmentData && metadata?.appointment_type === "provider_created") {
      const {
        locationId,
        serviceId,
        serviceName,
        scheduledDate,
        scheduledTime,
        durationMinutes,
        price,
        notes,
        clientName,
      } = appointmentData

      if (!locationId || !serviceId || !scheduledDate || !scheduledTime) {
        throw new Error("Missing appointment data for provider-created payment link")
      }

      const { data: pendingAppointment, error: pendingAppointmentError } = await supabase
        .from("appointments")
        .insert({
          provider_id: providerId,
          location_id: locationId,
          service_ids: [serviceId],
          service_name: serviceName || "Servicio",
          client_name: clientName || "Cliente",
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          duration_minutes: durationMinutes || 30,
          price: price || amount,
          notes: notes || null,
          status: "pending",
        })
        .select("id")
        .single()

      if (pendingAppointmentError || !pendingAppointment) {
        console.error("❌ Error creando cita pending:", pendingAppointmentError)
        throw new Error("No se pudo crear la cita pendiente")
      }

      pendingAppointmentId = pendingAppointment.id
      console.log("🕓 Cita pending creada:", pendingAppointmentId)
    }

    // Crear PaymentIntent
    const paymentIntentData: any = {
      amount: totalAmountCents,
      currency: currency.toLowerCase(),
      metadata: {
        ...metadata,
        appointment_id: pendingAppointmentId || metadata?.appointment_id || "",
        provider_id: providerId,
        stripe_account_id: providerData.stripe_account_id,
        service_amount: serviceAmount.toString(),
        platform_fee: platformFee.toString(),
        stripe_fee: stripeTotalFee.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        transfer_amount: serviceAmount.toString(),
        flow_type: "platform_first",
        client_user_id: user.id,
      },
    }

    // Si se proporciona un paymentMethodId, confirmar el pago automáticamente
    if (paymentMethodId) {
      console.log(`💳 Usando método de pago guardado: ${paymentMethodId}`)

      paymentIntentData.payment_method = paymentMethodId
      paymentIntentData.confirm = true
      paymentIntentData.off_session = true

      // Obtener el customer_id del perfil del cliente
      const { data: profileData } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single()

      if (profileData?.stripe_customer_id) {
        paymentIntentData.customer = profileData.stripe_customer_id
      }
    } else {
      // Si no hay paymentMethodId, usar automatic_payment_methods
      paymentIntentData.automatic_payment_methods = {
        enabled: true,
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData)

    console.log(`✅ Payment Intent creado: ${paymentIntent.id}`)
    console.log(`📝 Estado: ${paymentIntent.status}`)

    // Si el pago fue confirmado automáticamente
    if (paymentMethodId && paymentIntent.status === "succeeded") {
      console.log(`✅ Pago confirmado automáticamente con método guardado`)
      console.log(
        `📝 Transferencia pendiente: $${serviceAmount} → ${providerData.stripe_account_id}`,
      )
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        appointmentId: pendingAppointmentId,
        status: paymentIntent.status,
        breakdown: {
          serviceAmount: serviceAmount.toFixed(2),
          platformFee: platformFee.toFixed(2),
          stripeFee: stripeTotalFee.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          netAfterStripe: targetNet.toFixed(2),
          providerReceives: serviceAmount.toFixed(2),
          platformReceives: platformFee.toFixed(2),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
