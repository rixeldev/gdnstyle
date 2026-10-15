import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper para parsear precios que pueden venir como rangos "5.71 -- 5.83"
function parsePrice(price: any): number {
  if (!price) return 0

  // Si ya es número, devolverlo
  if (typeof price === "number") return price

  // Si es string, puede ser un rango
  const priceStr = String(price).trim()

  // Si contiene "--", es un rango, extraer el primer número
  if (priceStr.includes("--")) {
    const firstPrice = priceStr.split("--")[0].trim()
    return parseFloat(firstPrice) || 0
  }

  // Si no es rango, parsear directamente
  return parseFloat(priceStr) || 0
}

// Helper para delay entre peticiones
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Función helper para limpiar HTML y obtener solo texto
function cleanHtmlToText(html: string): string {
  if (!html) return ""

  let text = String(html)

  // Remover scripts y estilos completos
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")

  // Remover todas las imágenes
  text = text.replace(/<img[^>]*>/gi, "")

  // Convertir etiquetas de bloque en saltos de línea
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, "\n")

  // Remover todas las demás etiquetas HTML
  text = text.replace(/<[^>]+>/g, "")

  // Convertir entidades HTML comunes
  text = text.replace(/&nbsp;/g, " ")
  text = text.replace(/&amp;/g, "&")
  text = text.replace(/&lt;/g, "<")
  text = text.replace(/&gt;/g, ">")
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&apos;/g, "'")

  // Limpiar espacios múltiples y saltos de línea excesivos
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n")
  text = text.replace(/[ \t]+/g, " ")
  text = text.trim()

  return text
}

// Función helper para obtener Access Token usando email y apiKey
async function getCJAccessToken(email: string, apiKey: string): Promise<string> {
  const cjBaseUrl = "https://developers.cjdropshipping.com/api2.0/v1"

  try {
    console.log("🔑 Obteniendo Access Token...")

    const payload = {
      email: email,
      password: apiKey,
    }

    const response = await fetch(`${cjBaseUrl}/authentication/getAccessToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Error de autenticación:", errorText)
      throw new Error(`Error al obtener token: ${response.status}`)
    }

    const result = await response.json()

    if (result.code === 200 && result.data?.accessToken) {
      console.log("✓ Access Token obtenido")
      return result.data.accessToken
    }

    throw new Error(result.message || "No se pudo obtener el Access Token")
  } catch (error: any) {
    throw new Error(`Error al obtener Access Token: ${error.message}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Configuración de CJDropshipping
    const cjEmail = Deno.env.get("CJDROPSHIPPING_EMAIL")
    const cjApiKey = Deno.env.get("CJDROPSHIPPING_API_KEY")

    if (!cjEmail || !cjApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "CJDropshipping email y API Key no están configurados",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // Obtener Access Token (con caché en Supabase)
    let cjAccessToken: string
    const now = Date.now()

    const { data: cachedToken } = await supabase.from("cj_access_tokens").select("*").single()

    if (cachedToken && cachedToken.expires_at > now) {
      console.log("✓ Usando Access Token cacheado")
      cjAccessToken = cachedToken.access_token
    } else {
      try {
        cjAccessToken = await getCJAccessToken(cjEmail, cjApiKey)

        const expiresAt = now + 4 * 60 * 1000

        await supabase.from("cj_access_tokens").upsert({
          id: 1,
          access_token: cjAccessToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })

        console.log("✓ Access Token guardado en caché")
      } catch (error: any) {
        console.error("❌ Error al obtener Access Token:", error.message)
        return new Response(
          JSON.stringify({
            success: false,
            error: `Error de autenticación: ${error.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }
    }

    // Obtener lista de productos
    const cjApiUrl = "https://developers.cjdropshipping.com/api2.0/v1"

    console.log("📡 Obteniendo lista de productos de CJ Dropshipping...")

    const response = await fetch(`${cjApiUrl}/product/myProduct/query?pageNum=1&pageSize=50`, {
      method: "GET",
      headers: {
        "CJ-Access-Token": cjAccessToken,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Error de CJ:", errorText)
      throw new Error(`Error de CJDropshipping: ${response.status}`)
    }

    const result = await response.json()

    if (result.code !== 200 || !result.data) {
      throw new Error(result.message || "Error al obtener productos")
    }

    const products = result.data.list || result.data.content || result.data.data || []
    console.log(`📦 Total de productos encontrados: ${products.length}`)

    if (products.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          synced: 0,
          errors: 0,
          message: "No hay productos para sincronizar",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    let processedCount = 0
    let errorCount = 0

    // Procesar cada producto con delay para evitar 429
    for (let i = 0; i < products.length; i++) {
      const product = products[i]

      try {
        const productId = String(product.pid || product.productId)
        const productName =
          product.productNameEn || product.nameEn || product.productName || "Producto"
        console.log(`\n🔍 [${i + 1}/${products.length}] ${productName.substring(0, 50)}...`)

        // Delay de 2 segundos entre peticiones para evitar 429
        if (i > 0) {
          console.log("⏳ Esperando 2 segundos para evitar límite de API...")
          await delay(2000)
        }

        // Intentar obtener detalles completos
        let productDetails = null
        let imagesToSave: string[] = []
        const variantsToSave = []

        try {
          console.log(`📡 Obteniendo detalles completos...`)
          const detailsResponse = await fetch(`${cjApiUrl}/product/query?pid=${productId}`, {
            method: "GET",
            headers: {
              "CJ-Access-Token": cjAccessToken,
              "Content-Type": "application/json",
            },
          })

          if (detailsResponse.ok) {
            const detailsResult = await detailsResponse.json()

            if (detailsResult.code === 200 && detailsResult.data) {
              productDetails = detailsResult.data
              console.log(`✓ Detalles obtenidos exitosamente`)

              // Extraer imágenes
              if (productDetails.productImage) {
                if (Array.isArray(productDetails.productImage)) {
                  imagesToSave = productDetails.productImage.filter(
                    (url: any) => typeof url === "string" && url.startsWith("http"),
                  )
                } else if (typeof productDetails.productImage === "string") {
                  if (productDetails.productImage.startsWith("[")) {
                    try {
                      const parsedImages = JSON.parse(productDetails.productImage)
                      if (Array.isArray(parsedImages)) {
                        imagesToSave = parsedImages.filter(
                          (url: any) => typeof url === "string" && url.startsWith("http"),
                        )
                      }
                    } catch (e) {
                      console.log(`⚠️ Error parseando imágenes JSON`)
                    }
                  } else if (productDetails.productImage.startsWith("http")) {
                    imagesToSave = [productDetails.productImage]
                  }
                }
              }

              // Extraer variantes
              if (productDetails.variants && Array.isArray(productDetails.variants)) {
                for (const variant of productDetails.variants) {
                  const variantId = String(variant.vid || `${productId}-${variantsToSave.length}`)
                  const variantPrice = parsePrice(variant.sellPrice || product.sellPrice)

                  variantsToSave.push({
                    vid: variantId,
                    variant_name: variant.variantNameEn || variant.variantKey || "",
                    variant_key: variant.variantKey || null,
                    sku: variant.variantSku || product.sku || null,
                    price: variantPrice,
                    entry_price: parsePrice(variant.entryPrice || 0),
                    stock: 999,
                    weight: variant.packWeight || product.packWeight || null,
                  })
                }
              }
            } else {
              console.log(`⚠️ Respuesta sin datos válidos`)
            }
          } else if (detailsResponse.status === 429) {
            console.log(`⚠️ Límite de API alcanzado (429), usando datos básicos`)
          } else {
            console.log(`⚠️ Error ${detailsResponse.status} obteniendo detalles`)
          }
        } catch (detailError: any) {
          console.log(`⚠️ Error obteniendo detalles: ${detailError.message}`)
        }

        // Si no hay imágenes, usar la básica
        if (imagesToSave.length === 0 && (product.productImage || product.bigImage)) {
          imagesToSave = [product.productImage || product.bigImage]
        }

        console.log(`📸 ${imagesToSave.length} imágenes | 🎨 ${variantsToSave.length} variantes`)

        // Extraer descripción limpia
        let description = ""
        const descriptionSources = [
          productDetails?.description,
          productDetails?.productDesc,
          productDetails?.descriptionEn,
          product.description,
          product.productDesc,
          product.descriptionEn,
        ]

        for (const desc of descriptionSources) {
          if (desc && typeof desc === "string" && desc.length > 50) {
            description = cleanHtmlToText(desc)
            break
          }
        }

        if (!description) {
          description = productName
        }

        // Extraer precios
        const priceRange =
          product.sellPrice || product.totalPrice || productDetails?.sellPrice || "0"
        const prices = String(priceRange)
          .split("--")
          .map((p) => parsePrice(p.trim()))
        const maxPrice = Math.max(...prices)
        const minPrice = Math.min(...prices)

        // Guardar producto (SIN collection_id)
        const mainProduct = {
          id: productId,
          title: productDetails?.productNameEn || productName,
          description: description,
          handle: (productDetails?.productNameEn || productName || "producto")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .substring(0, 100),
          product_type:
            productDetails?.categoryName || product.productType || product.categoryName || "",
          tags: Array.isArray(product.propertyKeyList) ? product.propertyKeyList : [],
          price: maxPrice,
          currency_code: "USD",
          image_url: imagesToSave[0] || null,
          variant_id: String(product.vid || productId),
          available_for_sale: true,
          cj_product_id: productId,
          cj_sku: product.sku || null,
          cj_stock: 999,
          cj_sell_price: maxPrice,
          cj_cost_price: minPrice,
          cj_images: imagesToSave,
          cj_variants: variantsToSave,
        }

        const { error: productError } = await supabase.from("products").upsert(mainProduct, {
          onConflict: "id",
        })

        if (productError) {
          console.error(`❌ Error guardando producto:`, productError.message)
          errorCount++
          continue
        }

        processedCount++
        console.log(`✅ Producto guardado exitosamente (${processedCount}/${products.length})`)
      } catch (error: any) {
        console.error(`❌ Error procesando producto:`, error.message)
        errorCount++
      }
    }

    console.log(
      `\n🎉 Sincronización completada: ${processedCount} productos guardados, ${errorCount} errores`,
    )

    return new Response(
      JSON.stringify({
        success: true,
        synced: processedCount,
        errors: errorCount,
        total: products.length,
        message: `✅ Sincronizados ${processedCount} de ${products.length} productos (${errorCount} errores)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error: any) {
    console.error("❌ Error general:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al sincronizar productos",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
