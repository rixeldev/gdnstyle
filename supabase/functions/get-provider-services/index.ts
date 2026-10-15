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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    )

    // Obtener el usuario autenticado
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Obtener el proveedor
    const { data: provider, error: providerError } = await supabaseClient
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

    const { data: services, error: servicesError } = await supabaseClient
      .from("provider_services")
      .select("id, name, category, price, duration, description, is_active, image_url")
      .eq("provider_id", provider.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (servicesError) {
      throw servicesError
    }

    const categoryMap = new Map()
    const processedServices =
      services?.map((service) => {
        const currentCount = categoryMap.get(service.category) || 0
        categoryMap.set(service.category, currentCount + 1)

        return {
          id: service.id,
          name: service.name,
          category: service.category,
          price: parseFloat(service.price),
          duration: service.duration,
          description: service.description,
          isActive: service.is_active,
          image: service.image_url || null,
        }
      }) || []

    const categories = [{ id: "all", name: "Todos", count: processedServices.length }]

    const categoryNames = {
      barbershop: "Barbershop",
      "beauty-salon": "Beauty Salon",
      "spa-wellness": "Spa & Wellness",
      nails: "Nails",
    }

    for (const [categoryId, count] of categoryMap.entries()) {
      categories.push({
        id: categoryId,
        name: categoryNames[categoryId] || categoryId,
        count: count,
      })
    }

    return new Response(
      JSON.stringify({
        categories: categories,
        services: processedServices,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
