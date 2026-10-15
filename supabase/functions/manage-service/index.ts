import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const authHeader = req.headers.get("Authorization") ?? ""
    const token = authHeader.replace("Bearer ", "")

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      return new Response(JSON.stringify({ error: "Proveedor no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { action, serviceData } = await req.json()

    switch (action) {
      case "create":
        if (!serviceData?.name || !serviceData?.category) {
          return new Response(JSON.stringify({ error: "Nombre y categoría son requeridos" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        if (!serviceData?.price || !serviceData?.duration) {
          return new Response(JSON.stringify({ error: "Precio y duración son requeridos" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }

        const normalizedName = String(serviceData.name).trim()
        const normalizedCategory = String(serviceData.category).trim()
        const normalizedDescription = String(serviceData.description ?? "").trim()
        const parsedPrice = Number(serviceData.price)
        const parsedDuration = Number(serviceData.duration)

        if (!normalizedName || !normalizedCategory) {
          return new Response(JSON.stringify({ error: "Nombre y categoría inválidos" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
          return new Response(JSON.stringify({ error: "Precio inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
          return new Response(JSON.stringify({ error: "Duración inválida" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }

        const { data: categoryRows, error: categoryError } = await supabaseAdmin
          .from("business_categories")
          .select("id")
          .eq("category", normalizedCategory)
          .limit(1)
        if (categoryError) throw categoryError

        if (!categoryRows || categoryRows.length === 0) {
          return new Response(JSON.stringify({ error: "Categoría inválida" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }

        const { data: existingProviderService, error: existingProviderServiceError } =
          await supabaseAdmin
            .from("provider_services")
            .select("id")
            .eq("provider_id", provider.id)
            .ilike("name", normalizedName)
            .eq("category", normalizedCategory)
            .maybeSingle()

        if (existingProviderServiceError) throw existingProviderServiceError

        if (existingProviderService) {
          return new Response(
            JSON.stringify({ error: "Ese servicio ya está agregado en tu lista" }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          )
        }

        const { data: providerService, error: createProviderServiceError } = await supabaseAdmin
          .from("provider_services")
          .insert({
            provider_id: provider.id,
            name: normalizedName,
            description: normalizedDescription || null,
            category: normalizedCategory,
            image_url: null,
            price: parsedPrice,
            duration: parsedDuration,
            is_active: true,
          })
          .select("id, provider_id, name, category, price, duration, is_active")
          .single()

        if (createProviderServiceError) throw createProviderServiceError

        return new Response(JSON.stringify({ success: true, providerService }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })

      default:
        return new Response(JSON.stringify({ error: "Acción no válida. Usa action=create" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Error interno"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
