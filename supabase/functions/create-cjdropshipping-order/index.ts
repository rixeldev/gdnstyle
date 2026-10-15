import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Función helper para obtener Access Token usando API Key
async function getCJAccessToken(apiKey: string): Promise<string> {
  const cjBaseUrl = "https://developers.cjdropshipping.com/api2.0/v1"

  try {
    const response = await fetch(`${cjBaseUrl}/authentication/getAccessToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: apiKey,
      }),
    })

    if (!response.ok) {
      throw new Error(`Error al obtener token: ${response.status}`)
    }

    const result = await response.json()

    if (result.code === 200 && result.data?.accessToken) {
      return result.data.accessToken
    }

    throw new Error(result.msg || "No se pudo obtener el Access Token")
  } catch (error: any) {
    throw new Error(`Error al obtener Access Token: ${error.message || "Error desconocido"}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { orderId, cartItems, shippingInfo } = await req.json()

    if (!cartItems || cartItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "El carrito está vacío",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Configuración de CJDropshipping - usar API Key
    const cjApiKey = Deno.env.get("CJDROPSHIPPING_API_KEY")
    const cjApiUrl = "https://developers.cjdropshipping.com/api2.0/v1"

    if (!cjApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "CJDropshipping API Key no está configurado",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Obtener Access Token dinámicamente
    const cjAccessToken = await getCJAccessToken(cjApiKey)

    // Obtener productos de la base de datos
    const productIds = cartItems.map((item: any) => item.productId || item.id)
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds)

    if (productsError || !products) {
      throw new Error("Error al obtener productos")
    }

    // Crear productos para la orden de CJ
    const cjProducts = cartItems.map((item: any) => {
      const product = products.find((p: any) => String(p.id) === String(item.productId || item.id))
      if (!product || !product.cj_product_id) {
        throw new Error(`Producto ${item.productId || item.id} no tiene CJ product ID`)
      }

      return {
        productId: product.cj_product_id,
        quantity: item.quantity || 1,
      }
    })

    // Crear orden en CJDropshipping
    const cjOrderData = {
      products: cjProducts,
      shippingCountryCode: shippingInfo?.country || "CO",
      shippingCountry: shippingInfo?.country || "Colombia",
      shippingProvince: shippingInfo?.state || shippingInfo?.city || "",
      shippingCity: shippingInfo?.city || "",
      shippingAddress: shippingInfo?.address || "",
      shippingZipCode: shippingInfo?.postalCode || "",
      shippingName: `${shippingInfo?.firstName || ""} ${shippingInfo?.lastName || ""}`.trim(),
      shippingPhone: shippingInfo?.phone || "",
      shippingEmail: shippingInfo?.email || "",
      // Campos adicionales de CJ si los necesitas
      warehouseId: null, // Usar warehouse por defecto
      customOrderId: orderId, // ID de tu orden para tracking
    }

    const cjResponse = await fetch(`${cjApiUrl}/shopping/order/batchCreateOrder`, {
      method: "POST",
      headers: {
        "CJ-Access-Token": cjAccessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cjOrderData),
    })

    if (!cjResponse.ok) {
      const errorText = await cjResponse.text()
      throw new Error(`Error de CJDropshipping: ${cjResponse.status} - ${errorText}`)
    }

    const cjResult = await cjResponse.json()

    if (cjResult.code !== 200) {
      throw new Error(cjResult.msg || "Error al crear orden en CJDropshipping")
    }

    const cjOrder = cjResult.data

    // Actualizar orden en la base de datos con info de CJ
    await supabase
      .from("orders")
      .update({
        cj_order_id: cjOrder.orderId || cjOrder.id,
        cj_tracking_number: cjOrder.trackingNumber || null,
        status: "processing",
        cj_order_data: cjOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    return new Response(
      JSON.stringify({
        success: true,
        cjOrderId: cjOrder.orderId || cjOrder.id,
        trackingNumber: cjOrder.trackingNumber || null,
        message: "Orden creada en CJDropshipping exitosamente",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error: any) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al crear orden en CJDropshipping",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
