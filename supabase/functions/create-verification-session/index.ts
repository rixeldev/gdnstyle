import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

import { underRateLimit } from "../_shared/rate-limit.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function postAccountV2(secretKey: string, accountId: string, body: unknown) {
  const response = await fetch(`https://api.stripe.com/v2/core/accounts/${accountId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      "Stripe-Version": "2026-09-30.preview",
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  return { ok: response.ok, text }
}

async function requestConnectedIssuing(secretKey: string, accountId: string) {
  const recipientBody = {
    include: ["configuration.recipient"],
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
  }
  let recipient = await postAccountV2(secretKey, accountId, {
    ...recipientBody,
    dashboard: "none",
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
  })
  if (!recipient.ok && recipient.text.includes("defaults.responsibilities")) {
    recipient = await postAccountV2(secretKey, accountId, recipientBody)
  }
  if (!recipient.ok)
    throw new Error(
      stripeMessage(recipient.text, "Stripe no activó el destinatario en la cuenta conectada"),
    )

  const creator = await postAccountV2(secretKey, accountId, {
    include: ["configuration.card_creator"],
    configuration: {
      card_creator: {
        capabilities: {
          commercial: {
            stripe: {
              charge_card: { requested: true },
            },
          },
        },
      },
    },
  })
  if (!creator.ok && !creator.text.includes("card_creator")) {
    throw new Error(stripeMessage(creator.text, "Stripe no activó Issuing en la cuenta conectada"))
  }
}

function stripeMessage(errorText: string, fallback: string) {
  try {
    const errorData = JSON.parse(errorText)
    const message = errorData?.error?.message
    const code = errorData?.error?.code
    if (typeof message === "string" && message.trim()) {
      return code ? `${message} (${code})` : message
    }
  } catch {
    // El cuerpo no viene en JSON.
  }
  return errorText.trim() || fallback
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🚀 Iniciando flujo de onboarding de Connect...")

    // Obtener el token de autorización
    const authHeader = req.headers.get("Authorization")
    console.log("🔑 Authorization header:", authHeader ? "Presente" : "Ausente")

    if (!authHeader) {
      throw new Error("No se proporcionó token de autorización")
    }

    // Extraer el token del header
    const token = authHeader.replace("Bearer ", "")
    console.log("🎫 Token extraído:", token.substring(0, 20) + "...")

    // Crear cliente de Supabase con service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    console.log("🔧 Configurando Supabase con service role...")
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener usuario usando el token
    console.log("👤 Obteniendo usuario con token...")
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    console.log("👤 Resultado de getUser:", {
      user: user ? user.id : null,
      error: userError ? userError.message : null,
    })

    if (userError) {
      console.error("❌ Error al obtener usuario:", userError)
      throw new Error(`Error de autenticación: ${userError.message}`)
    }

    if (!user) {
      throw new Error("Usuario no autenticado - token inválido")
    }

    // Crear la cuenta Connect y activar Issuing son llamadas caras en Stripe.
    // Diez por usuario y hora deja el onboarding holgado y corta los bucles.
    if (!(await underRateLimit(supabase, `connect-onboarding:${user.id}`, 10, 3600))) {
      throw new Error("Demasiadas solicitudes. Espera unos minutos y vuelve a intentarlo.")
    }

    console.log("✅ Usuario autenticado:", user.id, user.email)

    // Obtener datos del proveedor
    console.log("🔍 Buscando proveedor para usuario:", user.id)
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (providerError) {
      console.error("❌ Error al obtener proveedor:", providerError)
      throw new Error(`Error al obtener datos del proveedor: ${providerError.message}`)
    }

    if (!provider) {
      throw new Error("Proveedor no encontrado para este usuario")
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")
    if (!stripeSecretKey) {
      throw new Error("Stripe no está configurado")
    }

    let payload: { return_url?: string } = {}
    try {
      payload = await req.json()
    } catch {
      payload = {}
    }

    const forwardedFor = req.headers.get("x-forwarded-for")
    const tosIp = (forwardedFor?.split(",")[0] || req.headers.get("x-real-ip") || "8.8.8.8").trim()
    let stripeAccountId = provider.stripe_account_id as string | null
    let accountType = ""

    if (stripeAccountId) {
      const currentResponse = await fetch(`https://api.stripe.com/v1/accounts/${stripeAccountId}`, {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      })
      if (currentResponse.ok) {
        const current = await currentResponse.json()
        accountType = current.type || ""
      }
    }

    // Express no admite Issuing. La cuenta de pagos nueva es Custom.
    if (!stripeAccountId || accountType !== "custom") {
      console.log("🆕 Creando cuenta Connect Custom...", {
        anterior: stripeAccountId,
        tipo: accountType || "ninguna",
      })
      const accountResponse = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          type: "custom",
          country: "US",
          email: provider.email || user.email || "",
          business_type: "individual",
          "capabilities[card_payments][requested]": "true",
          "capabilities[transfers][requested]": "true",
          "tos_acceptance[date]": String(Math.floor(Date.now() / 1000)),
          "tos_acceptance[ip]": tosIp,
        }),
      })

      if (!accountResponse.ok) {
        const accountErrorText = await accountResponse.text()
        console.error("❌ Error creando cuenta Connect:", accountErrorText)
        throw new Error(stripeMessage(accountErrorText, "Error al crear cuenta Connect"))
      }

      const accountData = await accountResponse.json()
      stripeAccountId = accountData.id

      const { error: updateProviderError } = await supabase
        .from("providers")
        .update({
          stripe_account_id: stripeAccountId,
          stripe_onboarding_completed: false,
          stripe_card_id: null,
          stripe_cardholder_id: null,
          card_last4: null,
          card_status: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", provider.id)

      if (updateProviderError) {
        console.error("❌ Error guardando cuenta Connect en provider:", updateProviderError)
        throw new Error(`Error actualizando proveedor: ${updateProviderError.message}`)
      }

      console.log("✅ Cuenta Custom creada y guardada:", stripeAccountId)
    }

    if (!stripeAccountId) {
      throw new Error("No se pudo resolver la cuenta Connect del proveedor")
    }

    await requestConnectedIssuing(stripeSecretKey, stripeAccountId)

    const connectedAccountId = stripeAccountId
    console.log("💳 Cuenta de Stripe encontrada:", connectedAccountId)

    const returnUrl = payload.return_url || `${req.headers.get("origin")}/provider/verify-account`
    const refreshUrl = `${returnUrl}?refresh=true`

    // Crear link de onboarding de Connect (flujo único de verificación).
    console.log("📝 Creando account link de Stripe Connect onboarding...")
    const onboardingResponse = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        account: connectedAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
        collect: "eventually_due",
      }),
    })

    if (!onboardingResponse.ok) {
      const errorText = await onboardingResponse.text()
      console.error("❌ Error creando onboarding de Connect:", errorText)
      throw new Error(`Error al crear onboarding de Connect: ${errorText}`)
    }

    const onboardingLink = await onboardingResponse.json()
    console.log("✅ Account link creado:", onboardingLink.url)

    return new Response(
      JSON.stringify({
        success: true,
        onboarding: true,
        url: onboardingLink.url,
        expires_at: onboardingLink.expires_at,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("❌ Error general:", error)
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    )
  }
})
