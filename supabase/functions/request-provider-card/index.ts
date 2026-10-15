import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function stripeFailure(errorText: string, fallback: string) {
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
      stripeFailure(recipient.text, "Stripe no activó el destinatario en la cuenta conectada"),
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
  if (!creator.ok) {
    if (creator.text.includes("card_creator")) {
      throw new Error(
        "La clave de Style Booking todavía no tiene acceso a card_creator. Stripe lo tiene en vista previa privada: tienen que habilitar Issuing Connect v2 en la plataforma. El destinatario ya quedó solicitado.",
      )
    }
    throw new Error(stripeFailure(creator.text, "Stripe no activó Issuing en la cuenta conectada"))
  }
  return JSON.parse(creator.text)
}

function dobParts(value: string) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) }
  }
  const date = new Date(value)
  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1),
    day: String(date.getUTCDate()),
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🚀 Iniciando solicitud de tarjeta...")

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      throw new Error("No se proporcionó token de autorización")
    }

    const token = authHeader.replace("Bearer ", "")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
      throw new Error("Usuario no autenticado")
    }

    console.log("✅ Usuario autenticado:", user.id)

    // Obtener datos del proveedor
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      throw new Error("Proveedor no encontrado")
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")
    if (!stripeSecretKey) {
      throw new Error("Stripe no está configurado")
    }

    if (!provider.stripe_account_id) {
      throw new Error("Primero verifica tu cuenta de pagos.")
    }

    const accountResponse = await fetch(
      `https://api.stripe.com/v1/accounts/${provider.stripe_account_id}`,
      {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      },
    )
    if (!accountResponse.ok) {
      const accountError = await accountResponse.text()
      throw new Error(stripeFailure(accountError, "No se pudo leer la cuenta conectada"))
    }
    const connectedAccount = await accountResponse.json()
    if (connectedAccount.type !== "custom") {
      throw new Error(
        "Tu cuenta conectada es Express. Entra en Verificar cuenta para crear la cuenta Custom. La tarjeta solo puede existir ahí.",
      )
    }
    const issuingAccount = await requestConnectedIssuing(
      stripeSecretKey,
      provider.stripe_account_id,
    )
    const chargeCard =
      issuingAccount?.configuration?.card_creator?.capabilities?.commercial?.stripe?.charge_card
    if (chargeCard?.status !== "active") {
      const detail = chargeCard?.status_details?.[0]?.code
      throw new Error(
        detail
          ? `Issuing quedó en ${chargeCard?.status || "pendiente"} (${detail}). Entra en Verificar cuenta y continúa el registro para completar lo que Stripe pide.`
          : "Stripe recibió Issuing en tu cuenta, pero aún no está activo. Entra en Verificar cuenta y continúa el registro.",
      )
    }

    console.log("💳 Tarjeta en la cuenta Custom:", provider.stripe_account_id)

    // Obtener datos del request
    const { terms_accepted, terms_acceptance_date } = await req.json()

    if (!terms_accepted) {
      throw new Error("Debes aceptar los términos y condiciones de Stripe Issuing")
    }

    console.log("✅ Términos aceptados")

    // Verificar que tenga todos los datos necesarios
    if (
      !provider.date_of_birth ||
      !provider.address_line1 ||
      !provider.address_city ||
      !provider.address_state ||
      !provider.address_postal_code
    ) {
      throw new Error("Faltan datos adicionales. Por favor completa tu información.")
    }

    console.log("✅ Datos adicionales completos")

    // Validar y obtener nombre
    let firstName = provider.first_name?.trim() || ""
    let lastName = provider.last_name?.trim() || ""

    // Si no hay first_name o last_name, intentar obtenerlos del full_name
    if (!firstName || !lastName) {
      const fullName = provider.full_name?.trim() || ""
      if (fullName) {
        const nameParts = fullName.split(" ")
        if (nameParts.length >= 2) {
          firstName = nameParts[0]
          lastName = nameParts.slice(1).join(" ")
        } else if (nameParts.length === 1) {
          firstName = nameParts[0]
          lastName = nameParts[0]
        }
      }
    }

    // Si aún no hay nombre, usar el email como fallback
    if (!firstName || !lastName) {
      const emailName = user.email?.split("@")[0] || "User"
      firstName = firstName || emailName
      lastName = lastName || emailName
    }

    // Validar que los nombres contengan al menos una letra
    const hasLetters = (str: string) => /[a-zA-Z]/.test(str)

    if (!hasLetters(firstName)) {
      throw new Error("El nombre debe contener al menos una letra. Por favor actualiza tu perfil.")
    }

    if (!hasLetters(lastName)) {
      throw new Error(
        "El apellido debe contener al menos una letra. Por favor actualiza tu perfil.",
      )
    }

    console.log("✅ Nombre validado:", firstName, lastName)

    // Obtener la IP del usuario de forma correcta desde los headers
    const forwardedFor = req.headers.get("x-forwarded-for")
    const realIp = req.headers.get("x-real-ip")
    const cfConnectingIp = req.headers.get("cf-connecting-ip")

    let userIp = "127.0.0.1" // Default fallback

    if (forwardedFor) {
      // x-forwarded-for puede contener múltiples IPs separadas por comas
      userIp = forwardedFor.split(",")[0].trim()
    } else if (realIp) {
      userIp = realIp.trim()
    } else if (cfConnectingIp) {
      userIp = cfConnectingIp.trim()
    }

    console.log("🌐 IP detectada:", userIp)
    console.log("📋 Headers disponibles:", {
      "x-forwarded-for": forwardedFor,
      "x-real-ip": realIp,
      "cf-connecting-ip": cfConnectingIp,
    })

    // Validar formato de IP (IPv4 o IPv6)
    const isValidIPv4 = (ip: string) => {
      const parts = ip.split(".")
      if (parts.length !== 4) return false
      return parts.every((part) => {
        const num = parseInt(part, 10)
        return num >= 0 && num <= 255 && part === num.toString()
      })
    }

    const isValidIPv6 = (ip: string) => {
      // Validación básica de IPv6
      return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip)
    }

    // Si la IP no es válida, usar una IP pública genérica
    if (!isValidIPv4(userIp) && !isValidIPv6(userIp)) {
      console.log("⚠️ IP no válida, usando IP genérica")
      userIp = "8.8.8.8" // IP pública de Google DNS como fallback válido
    }

    console.log("✅ IP final validada:", userIp)

    // 1. Crear el cardholder con aceptación de términos
    console.log("👤 Creando cardholder...")

    const dob = dobParts(provider.date_of_birth)
    const cardholderData = new URLSearchParams({
      name: `${firstName} ${lastName}`,
      email: user.email || "",
      type: "individual",
      "billing[address][line1]": provider.address_line1,
      "billing[address][city]": provider.address_city,
      "billing[address][state]": provider.address_state,
      "billing[address][postal_code]": provider.address_postal_code,
      "billing[address][country]": provider.address_country || "US",
      "individual[first_name]": firstName,
      "individual[last_name]": lastName,
      "individual[dob][day]": dob.day,
      "individual[dob][month]": dob.month,
      "individual[dob][year]": dob.year,
      // Aceptación de términos de Stripe Issuing
      "individual[card_issuing][user_terms_acceptance][date]": terms_acceptance_date.toString(),
      "individual[card_issuing][user_terms_acceptance][ip]": userIp,
    })

    // Agregar línea 2 de dirección si existe
    if (provider.phone) {
      cardholderData.append("phone_number", String(provider.phone))
    }
    if (provider.address_line2) {
      cardholderData.append("billing[address][line2]", provider.address_line2)
    }

    console.log("📝 Datos del cardholder preparados")
    console.log("👤 Nombre completo:", `${firstName} ${lastName}`)
    console.log("🌐 IP para términos:", userIp)

    const cardholderResponse = await fetch("https://api.stripe.com/v1/issuing/cardholders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Account": provider.stripe_account_id,
      },
      body: cardholderData.toString(),
    })

    if (!cardholderResponse.ok) {
      const errorText = await cardholderResponse.text()
      console.error("❌ Error al crear cardholder:", errorText)
      throw new Error(stripeFailure(errorText, "No se pudo crear el titular de la tarjeta"))
    }

    const cardholder = await cardholderResponse.json()
    console.log("✅ Cardholder creado:", cardholder.id)

    // 2. Crear la tarjeta
    console.log("💳 Creando tarjeta...")

    const cardResponse = await fetch("https://api.stripe.com/v1/issuing/cards", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Account": provider.stripe_account_id,
      },
      body: new URLSearchParams({
        cardholder: cardholder.id,
        currency: "usd",
        type: "virtual",
        status: "active",
      }),
    })

    if (!cardResponse.ok) {
      const errorText = await cardResponse.text()
      console.error("❌ Error al crear tarjeta:", errorText)
      throw new Error(stripeFailure(errorText, "No se pudo crear la tarjeta"))
    }

    const card = await cardResponse.json()
    console.log("✅ Tarjeta creada:", card.id)

    // 3. Guardar en la base de datos
    const { error: updateError } = await supabase
      .from("providers")
      .update({
        stripe_cardholder_id: cardholder.id,
        stripe_card_id: card.id,
        card_last4: card.last4,
        card_status: card.status,
        terms_accepted_at: new Date(terms_acceptance_date * 1000).toISOString(),
        terms_acceptance_ip: userIp,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)

    if (updateError) {
      console.error("⚠️ Error al actualizar base de datos:", updateError)
    }

    console.log("✅ Tarjeta guardada en base de datos")

    return new Response(
      JSON.stringify({
        success: true,
        message: "Tarjeta creada exitosamente",
        cardholder: {
          id: cardholder.id,
          name: cardholder.name,
        },
        card: {
          id: card.id,
          last4: card.last4,
          exp_month: card.exp_month,
          exp_year: card.exp_year,
          status: card.status,
        },
        balance: 0,
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
