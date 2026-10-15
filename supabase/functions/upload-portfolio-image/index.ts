import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    console.log("=== INICIO DE SOLICITUD ===")

    const authHeader = req.headers.get("Authorization")
    console.log("Authorization header:", authHeader ? "Existe" : "NO EXISTE")

    if (!authHeader) {
      throw new Error("No se proporcionó token de autorización")
    }

    // Usar las variables de entorno correctas de Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    console.log("Supabase URL:", supabaseUrl ? "Configurada" : "NO CONFIGURADA")
    console.log("Service Key:", supabaseServiceKey ? "Configurada" : "NO CONFIGURADA")

    // Cliente admin para operaciones de storage y base de datos
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Extraer el token del header
    const token = authHeader.replace("Bearer ", "")
    console.log("Token extraído, longitud:", token.length)

    // Verificar autenticación usando getUser con el token
    console.log("Verificando autenticación...")
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    console.log("Auth error:", authError)
    console.log("User:", user ? `ID: ${user.id}` : "NO USER")

    if (authError || !user) {
      console.error("Error de autenticación:", authError)
      throw new Error("No autorizado - Token inválido o expirado")
    }

    console.log("Usuario autenticado:", user.id)

    // Verificar que sea un proveedor
    console.log("Verificando si es proveedor...")
    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single()

    console.log("Provider error:", providerError)
    console.log("Provider:", provider)

    if (providerError || !provider) {
      console.error("Error al verificar proveedor:", providerError)
      throw new Error("Solo los proveedores pueden subir fotos al portafolio")
    }

    console.log("Proveedor verificado:", provider.id)

    const formData = await req.formData()
    const file = formData.get("file") as File
    const title = formData.get("title") as string
    const description = formData.get("description") as string

    console.log("Archivo recibido:", file ? `${file.name} (${file.size} bytes)` : "NO FILE")

    if (!file) {
      throw new Error("No se proporcionó ningún archivo")
    }

    // Validar tipo de archivo
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG o WebP")
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      throw new Error("El archivo es demasiado grande. Máximo 5MB")
    }

    // Generar nombre único para el archivo dentro de la carpeta "porfolioprovider/{provider_id}"
    const fileExt = file.name.split(".").pop()
    const fileName = `porfolioprovider/${user.id}/${Date.now()}.${fileExt}`

    console.log("Subiendo archivo a Storage:", fileName)

    // Convertir File a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    // Subir archivo a Supabase Storage usando admin client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("portfolio")
      .upload(fileName, fileData, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("Error al subir archivo:", uploadError)
      throw new Error(`Error al subir la imagen: ${uploadError.message}`)
    }

    console.log("Archivo subido exitosamente")

    // Obtener URL pública de la imagen
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("portfolio").getPublicUrl(fileName)

    console.log("URL pública generada:", publicUrl)

    // Guardar en la base de datos - USAR user.id
    console.log("Guardando en base de datos...")
    const { data: portfolioData, error: dbError } = await supabaseAdmin
      .from("provider_portfolio")
      .insert({
        provider_id: user.id,
        image_url: publicUrl,
        title: title || "Sin título",
        description: description || "",
        likes_count: 0,
        comments_count: 0,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Error en BD:", dbError)
      // Si falla la BD, eliminar la imagen subida
      await supabaseAdmin.storage.from("portfolio").remove([fileName])
      throw new Error(`Error al guardar en la base de datos: ${dbError.message}`)
    }

    console.log("Guardado exitoso en BD")
    console.log("=== FIN DE SOLICITUD EXITOSA ===")

    return new Response(
      JSON.stringify({
        success: true,
        data: portfolioData,
        message: "Foto publicada exitosamente",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("=== ERROR EN SOLICITUD ===")
    console.error("Error:", error)
    console.error("Error message:", error.message)
    console.error("Error stack:", error.stack)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    )
  }
})
