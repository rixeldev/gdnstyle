import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type WelcomePayload = {
  email?: string
  name?: string
  role?: "client" | "provider" | string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function getRoleLabel(role: string): string {
  return role === "provider" ? "profesional" : "cliente"
}

function getMainMessage(role: string): string {
  if (role === "provider") {
    return "Gracias por preferirnos y formar parte de GDN Style como profesional. Nos alegra tenerte en nuestra comunidad."
  }

  return "Gracias por registrarte en GDN Style. Estamos felices de acompañarte en tu experiencia de reservas y servicios."
}

function buildTelLink(phone: string): string {
  const digits = phone.replaceAll(/[^+\d]/g, "")
  return digits ? `tel:${digits}` : "tel:+10000000000"
}

function buildHtmlEmail(name: string, role: string): string {
  const safeName = escapeHtml(name || "Hola")
  const roleLabel = escapeHtml(getRoleLabel(role))
  const message = escapeHtml(getMainMessage(role))

  const logoUrl = Deno.env.get("WELCOME_LOGO_URL") ?? "https://www.gdnstyle.com/logos/gdnstyle.png"
  const websiteUrl = Deno.env.get("WELCOME_WEBSITE_URL") ?? "https://www.gdnstyle.com"
  const appUrl = Deno.env.get("WELCOME_APP_URL") ?? websiteUrl
  const phone = Deno.env.get("WELCOME_PHONE") ?? "+1 (000) 000-0000"
  const phoneLink = buildTelLink(phone)
  const supportEmail = Deno.env.get("WELCOME_SUPPORT_EMAIL") ?? "soporte@gdnstyle.com"
  const instagramUrl = Deno.env.get("WELCOME_INSTAGRAM_URL") ?? "https://www.instagram.com"
  const facebookUrl = Deno.env.get("WELCOME_FACEBOOK_URL") ?? "https://www.facebook.com"
  const tiktokUrl = Deno.env.get("WELCOME_TIKTOK_URL") ?? "https://www.tiktok.com"
  const instagramIcon =
    Deno.env.get("WELCOME_INSTAGRAM_ICON_URL") ??
    "https://img.icons8.com/color/96/instagram-new--v1.png"
  const facebookIcon =
    Deno.env.get("WELCOME_FACEBOOK_ICON_URL") ?? "https://img.icons8.com/color/96/facebook-new.png"
  const tiktokIcon =
    Deno.env.get("WELCOME_TIKTOK_ICON_URL") ?? "https://img.icons8.com/color/96/tiktok--v1.png"
  const googlePlayUrl = Deno.env.get("WELCOME_GOOGLE_PLAY_URL") ?? "https://play.google.com/store"
  const appStoreUrl = Deno.env.get("WELCOME_APP_STORE_URL") ?? "https://www.apple.com/app-store/"
  const googlePlayBadge =
    Deno.env.get("WELCOME_GOOGLE_PLAY_BADGE_URL") ??
    "https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
  const appStoreBadge =
    Deno.env.get("WELCOME_APP_STORE_BADGE_URL") ??
    "https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bienvenido a GDN Style</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 24px 20px;text-align:center;background:linear-gradient(135deg,#0f172a,#1e293b);">
                <a href="${appUrl}" target="_blank" rel="noreferrer" style="text-decoration:none;">
                  <img src="${logoUrl}" alt="GDN Style" width="200" style="max-width:100%;height:auto;display:block;margin:0 auto 16px;" />
                </a>
                <p style="margin:0;font-size:14px;color:#e5e7eb;">Bienvenido a GDN Style</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#111827;">Gracias por registrarte</h1>
                <p style="margin:0 0 10px;font-size:16px;line-height:1.6;">
                  ${safeName}, te damos la bienvenida como ${roleLabel} en GDN Style.
                </p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                  ${message}
                </p>
                <p style="margin:24px 0;text-align:center;">
                  <a href="${appUrl}" target="_blank" rel="noreferrer" style="display:inline-block;padding:14px 24px;background:#c9942f;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;">
                    Ir a GDN Style
                  </a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
                  Si tienes preguntas, nuestro equipo de soporte estara encantado de ayudarte.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b7280;text-align:center;">
                  Telefono:
                  <a href="${phoneLink}" style="color:#2563eb;text-decoration:none;">${escapeHtml(phone)}</a>
                  | Email:
                  <a href="mailto:${escapeHtml(supportEmail)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(supportEmail)}</a>
                </p>
                <p style="margin:0 0 14px;text-align:center;">
                  <a href="${instagramUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${instagramIcon}" alt="Instagram" width="28" height="28" style="display:block;width:28px;height:28px;" />
                  </a>
                  <a href="${facebookUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${facebookIcon}" alt="Facebook" width="28" height="28" style="display:block;width:28px;height:28px;" />
                  </a>
                  <a href="${tiktokUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${tiktokIcon}" alt="TikTok" width="28" height="28" style="display:block;width:28px;height:28px;" />
                  </a>
                </p>
                <p style="margin:0 0 12px;text-align:center;">
                  <a href="${googlePlayUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${googlePlayBadge}" alt="Disponible en Google Play" height="40" style="display:block;height:40px;width:auto;" />
                  </a>
                  <a href="${appStoreUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${appStoreBadge}" alt="Descargar en App Store" height="40" style="display:block;height:40px;width:auto;" />
                  </a>
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">
                  © ${new Date().getFullYear()} GDN Style. Todos los derechos reservados.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY")
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "GDN Style <no-reply@gdnstyle.com>"

    if (!resendApiKey) {
      throw new Error("Falta RESEND_API_KEY en variables de entorno.")
    }

    const payload = (await req.json()) as WelcomePayload
    const toEmail = payload.email
    if (!toEmail) {
      throw new Error("No se encontro el email del destinatario.")
    }

    const fullName = payload.name ?? "Hola"
    const role = payload.role === "provider" ? "provider" : "client"

    const html = buildHtmlEmail(fullName, role)

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: "Gracias por registrarte en GDN Style",
        html,
      }),
    })

    const resendData = await resendResponse.json()
    if (!resendResponse.ok) {
      console.error("Resend error:", resendData)
      return new Response(
        JSON.stringify({ error: "Error enviando email con Resend", details: resendData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    return new Response(JSON.stringify({ success: true, resend: resendData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido"
    console.error("send-welcome-email:", message)
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
