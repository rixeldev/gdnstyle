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
    )

    // Este webhook se ejecuta cuando Supabase Auth detecta cambios
    const { type, table, record, old_record } = await req.json()

    // Solo procesar confirmaciones de email
    if (type === "UPDATE" && table === "users") {
      const newRecord = record
      const oldRecord = old_record

      // Verificar si el email se acaba de confirmar
      if (newRecord.email_confirmed_at && !oldRecord.email_confirmed_at) {
        console.log("Email confirmado para usuario:", newRecord.id)

        // Verificar si es un provider
        const { data: provider, error: providerError } = await supabaseClient
          .from("providers")
          .select("*")
          .eq("id", newRecord.id)
          .single()

        if (provider && !providerError) {
          // Flujo actualizado: Stripe Connect se crea únicamente cuando el proveedor
          // inicia "Verificar cuenta", no al confirmar email.
          console.log(
            "Usuario provider confirmado por email. Se omite creación automática de Stripe.",
          )
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    console.error("Error en webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
