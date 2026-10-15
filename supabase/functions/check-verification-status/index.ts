import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
)

serve(async (req) => {
  try {
    console.log("🔍 Verificando estado de cuenta...")

    // 1. Obtener el usuario autenticado
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.error("❌ No hay header de autorización")
      return new Response(JSON.stringify({ success: false, error: "Usuario no autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const token = authHeader.replace("Bearer ", "")

    // Usar getUser en lugar de verificar el JWT manualmente
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      console.error("❌ Error al obtener usuario:", userError)
      return new Response(JSON.stringify({ success: false, error: "Usuario no autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    console.log("✅ Usuario autenticado:", user.id, user.email)

    // 2. Buscar el proveedor en la base de datos
    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      console.error("❌ Proveedor no encontrado:", providerError)
      return new Response(JSON.stringify({ success: false, error: "Proveedor no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    console.log("✅ Proveedor encontrado:", provider.id)
    console.log("📊 Datos del proveedor desde la tabla:", {
      identity_verified: provider.identity_verified,
      account_ready: provider.account_ready,
      charges_enabled: provider.charges_enabled,
      payouts_enabled: provider.payouts_enabled,
      requirements_due: provider.requirements_due,
    })

    // 3. Leer directamente de la tabla providers (sin consultar Stripe)
    const requirementsDueArray = provider.requirements_due
      ? typeof provider.requirements_due === "string"
        ? provider.requirements_due.split(",").filter((r: string) => r.trim())
        : provider.requirements_due
      : []

    // Verificar estado Connect completo (sin depender de Stripe Identity).
    const isFullyVerified =
      provider.account_ready === true &&
      provider.charges_enabled === true &&
      provider.payouts_enabled === true &&
      requirementsDueArray.length === 0

    console.log("🎯 Estado de verificación completa:", isFullyVerified)

    // 4. Devolver el estado actual desde la base de datos
    return new Response(
      JSON.stringify({
        success: true,
        identity_verified: provider.identity_verified || false,
        account_ready: provider.account_ready || false,
        charges_enabled: provider.charges_enabled || false,
        payouts_enabled: provider.payouts_enabled || false,
        requirements_due: requirementsDueArray,
        fully_verified: isFullyVerified,
        stripe_account_id: provider.stripe_account_id,
        message: isFullyVerified
          ? "Cuenta completamente verificada"
          : "Verificación pendiente o incompleta",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("❌ Error al verificar estado:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al verificar el estado",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
