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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    // Verificar autenticación
    const authHeader = req.headers.get("Authorization")!
    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.error("Authentication error in manage-provider-location:", authError)
      throw new Error("No autorizado")
    }

    const body = await req.json()
    const { action, locationData, locationId, category: bodyCategory } = body

    // Obtener el provider_id del usuario autenticado
    const { data: provider, error: providerError } = await supabaseClient
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      console.error("Provider lookup error in manage-provider-location:", providerError)
      throw new Error("Provider no encontrado")
    }

    if (action === "get") {
      // Obtener la locación actual del provider
      const { data: providerLocation, error } = await supabaseClient
        .from("provider_locations")
        .select(
          `
          id,
          location_id,
          category,
          locations (
            id,
            name,
            address,
            city,
            state,
            country,
            latitude,
            longitude,
            category
          )
        `,
        )
        .eq("provider_id", provider.id)
        .maybeSingle()

      if (error) {
        console.error("Error fetching provider location:", error)
      }

      return new Response(
        JSON.stringify({
          location: providerLocation || null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      )
    }

    if (action === "set") {
      let finalLocationId = locationId
      let locationCategory = null

      // Si no se proporciona locationId, crear nueva locación
      if (!locationId && locationData) {
        // Crear nueva locación directamente
        const { data: newLocation, error: locationError } = await supabaseClient
          .from("locations")
          .insert({
            name: locationData.name,
            address: locationData.address,
            city: locationData.city,
            state: locationData.state,
            country: locationData.country,
            category: locationData.category || null,
            latitude: locationData.latitude || null,
            longitude: locationData.longitude || null,
            image_url: locationData.image_url || null,
            image_alt: locationData.image_alt || null,
          })
          .select("id, category")
          .single()

        if (locationError) {
          console.error("Error creating location:", locationError)
          throw new Error(`Error creando locación: ${locationError.message}`)
        }

        finalLocationId = newLocation.id
        locationCategory = newLocation.category
      } else if (locationId) {
        // Si el front envía categoría al seleccionar locación existente, usarla; si no, leer de la locación
        if (bodyCategory != null && String(bodyCategory).trim() !== "") {
          locationCategory = String(bodyCategory).trim()
        } else {
          const { data: locationInfo, error: locationError } = await supabaseClient
            .from("locations")
            .select("category")
            .eq("id", locationId)
            .single()

          if (locationError) {
            console.error("Error fetching location category:", locationError)
          } else {
            locationCategory = locationInfo?.category
          }
        }
      }

      if (!finalLocationId) {
        throw new Error("ID de locación requerido")
      }

      // Verificar si ya existe una asignación
      const { data: existingAssignment, error: checkError } = await supabaseClient
        .from("provider_locations")
        .select("id, location_id")
        .eq("provider_id", provider.id)
        .maybeSingle()

      if (checkError) {
        console.error("Error checking existing provider location assignment:", checkError)
        throw new Error(`Error verificando asignación: ${checkError.message}`)
      }

      if (existingAssignment) {
        // Actualizar la locación existente CON la categoría
        const { data: updatedLocation, error: updateError } = await supabaseClient
          .from("provider_locations")
          .update({
            location_id: finalLocationId,
            category: locationCategory,
          })
          .eq("provider_id", provider.id)
          .select(
            `
            id,
            location_id,
            category,
            locations (
              id,
              name,
              address,
              city,
              state,
              country,
              latitude,
              longitude,
              category
            )
          `,
          )
          .single()

        if (updateError) {
          console.error("Error updating provider location:", updateError)
          throw new Error(`Error actualizando locación: ${updateError.message}`)
        }
        return new Response(
          JSON.stringify({
            success: true,
            location: updatedLocation,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        )
      } else {
        // Crear nueva asignación CON la categoría
        const { data: providerLocation, error: assignError } = await supabaseClient
          .from("provider_locations")
          .insert({
            provider_id: provider.id,
            location_id: finalLocationId,
            category: locationCategory,
          })
          .select(
            `
            id,
            location_id,
            category,
            locations (
              id,
              name,
              address,
              city,
              state,
              country,
              latitude,
              longitude,
              category
            )
          `,
          )
          .single()

        if (assignError) {
          console.error("Error assigning provider location:", assignError)
          throw new Error(`Error asignando locación: ${assignError.message}`)
        }
        return new Response(
          JSON.stringify({
            success: true,
            location: providerLocation,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        )
      }
    }

    throw new Error("Acción no válida")
  } catch (error) {
    console.error("Unhandled error in manage-provider-location:", error)
    return new Response(
      JSON.stringify({
        error: error.message || "Error gestionando locación",
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    )
  }
})
