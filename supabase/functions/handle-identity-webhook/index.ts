import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-11-20.acacia",
})

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
)

serve(async (req) => {
  // Secreto propio de este endpoint (no reutilizar STRIPE_WEBHOOK_SECRET del webhook de pagos).
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return new Response(JSON.stringify({ error: "No signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const webhookSecret = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET")
  if (!webhookSecret) {
    console.error("⚠️ STRIPE_IDENTITY_WEBHOOK_SECRET no configurado")
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("❌ Firma webhook inválida:", message)
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    console.log("🎯 Webhook recibido - Sync de Stripe Connect")

    console.log("📦 Tipo de evento:", event.type)

    // Solo procesar eventos relevantes de Connect / Identity.
    if (
      event.type !== "account.updated" &&
      event.type !== "identity.verification_session.verified"
    ) {
      console.log(
        "⏭️ Evento ignorado (no es account.updated ni identity.verification_session.verified)",
      )
      return new Response(JSON.stringify({ success: true, message: "Evento ignorado" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    let stripeAccountId: string | null = null
    let verificationReportId: string | null = null

    if (event.type === "account.updated") {
      const account = event.data.object
      stripeAccountId = account?.id || null
      console.log("💳 Stripe Account ID (account.updated):", stripeAccountId)
    } else {
      const session = event.data.object
      const metadata = session.metadata || {}
      stripeAccountId = metadata.stripe_account_id || null
      verificationReportId = session.last_verification_report || null
      console.log("💳 Stripe Account ID (identity):", stripeAccountId)
      console.log("📋 Verification Report ID:", verificationReportId)
    }

    if (!stripeAccountId) {
      console.error("❌ Falta stripe_account_id para sincronizar")
      return new Response(
        JSON.stringify({
          success: false,
          error: "Falta stripe_account_id para sincronizar",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    // 1. Obtener el estado actual de la cuenta Connect
    console.log("🔍 Consultando estado actual de cuenta Connect...")
    let accountData
    try {
      accountData = await stripe.accounts.retrieve(stripeAccountId)
      console.log("✅ Cuenta Connect obtenida exitosamente")
    } catch (error) {
      console.error("❌ Error al obtener cuenta Connect:", error.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Error al obtener cuenta Connect: ${error.message}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    // 2. Verificar si la cuenta ya está completamente habilitada
    const currentlyEnabled =
      accountData.charges_enabled === true &&
      accountData.payouts_enabled === true &&
      (!accountData.requirements?.currently_due ||
        accountData.requirements.currently_due.length === 0)

    console.log("📊 Estado actual de Connect:", {
      charges_enabled: accountData.charges_enabled,
      payouts_enabled: accountData.payouts_enabled,
      requirements_due: accountData.requirements?.currently_due || [],
      currently_enabled: currentlyEnabled,
    })

    // 3. Si NO está habilitada, HABILITARLA automáticamente
    if (!currentlyEnabled) {
      console.log("🚀 Habilitando cuenta Connect automáticamente...")

      try {
        // Solicitar capabilities para habilitar pagos y transferencias
        console.log("🔧 Solicitando capabilities para habilitar pagos...")

        await stripe.accounts.update(stripeAccountId, {
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        })

        console.log("✅ Capabilities solicitadas exitosamente")

        // Volver a obtener el estado actualizado
        accountData = await stripe.accounts.retrieve(stripeAccountId)
        console.log("🔄 Estado actualizado obtenido")
      } catch (updateError) {
        console.error("⚠️ Error al habilitar cuenta Connect:", updateError.message)
        // Continuar con el proceso aunque falle la habilitación automática
        console.log("📝 Continuando con el guardado en base de datos...")
      }
    } else {
      console.log("✅ Cuenta Connect ya está habilitada")
    }

    // 4. Analizar el estado final de la cuenta
    const finalChargesEnabled = accountData.charges_enabled || false
    const finalPayoutsEnabled = accountData.payouts_enabled || false
    const finalRequirementsDue = accountData.requirements?.currently_due || []
    const accountReady = finalRequirementsDue.length === 0

    // Determinar si la cuenta Connect está completamente verificada
    const stripeConnectVerified =
      finalChargesEnabled === true &&
      finalPayoutsEnabled === true &&
      accountReady === true &&
      finalRequirementsDue.length === 0

    console.log("🎯 Estado final de la cuenta:", {
      charges_enabled: finalChargesEnabled,
      payouts_enabled: finalPayoutsEnabled,
      requirements_due: finalRequirementsDue,
      stripe_connect_verified: stripeConnectVerified,
    })

    // 5. Construir datos a sincronizar en providers
    console.log("💾 Guardando estado final en base de datos...")

    const individual = accountData.individual as any
    const individualAddress = individual?.address as any
    const dob = individual?.dob as any
    const canBuildDob = dob?.year && dob?.month && dob?.day
    const dateOfBirth = canBuildDob
      ? `${String(dob.year).padStart(4, "0")}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`
      : null

    const updateData: Record<string, any> = {
      account_ready: accountReady,
      charges_enabled: finalChargesEnabled,
      payouts_enabled: finalPayoutsEnabled,
      requirements_due: finalRequirementsDue.length > 0 ? finalRequirementsDue.join(",") : null,
      stripe_connect_verified: stripeConnectVerified,
      stripe_onboarding_completed: accountData.details_submitted === true,
      address_line1: individualAddress?.line1 || null,
      address_line2: individualAddress?.line2 || null,
      address_city: individualAddress?.city || null,
      address_state: individualAddress?.state || null,
      address_postal_code: individualAddress?.postal_code || null,
      address_country: individualAddress?.country || null,
      updated_at: new Date().toISOString(),
    }

    // Solo actualizar estos campos cuando Stripe los expone en el payload.
    if (dateOfBirth) {
      updateData.date_of_birth = dateOfBirth
    }
    if (verificationReportId) {
      updateData.identity_verified = true
      updateData.verification_report_id = verificationReportId
    }

    const { error: updateError } = await supabaseAdmin
      .from("providers")
      .update(updateData)
      .eq("stripe_account_id", stripeAccountId)

    if (updateError) {
      console.error("❌ Error al actualizar base de datos:", updateError)
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error al actualizar base de datos",
          details: updateError.message,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    console.log("✅ Base de datos actualizada exitosamente")
    console.log("📊 Datos guardados:", updateData)

    // Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        message: stripeConnectVerified
          ? "Verificación completada - Cuenta Connect habilitada automáticamente"
          : "Identity verificado - Cuenta Connect en proceso de habilitación",
        data: {
          identity_verified: updateData.identity_verified ?? null,
          stripe_connect_verified: stripeConnectVerified,
          account_ready: accountReady,
          charges_enabled: finalChargesEnabled,
          payouts_enabled: finalPayoutsEnabled,
          requirements_due: finalRequirementsDue,
        },
        note: stripeConnectVerified
          ? "🎉 ¡Tu cuenta está lista para recibir pagos!"
          : "⏳ La cuenta Connect se está habilitando automáticamente",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("❌ Error en webhook:", error)

    // Siempre devolver 200 para evitar reintentos de Stripe
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        note: "Error procesado, no se reintentará",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }
})
