import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

import { underRateLimit } from "../_shared/rate-limit.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type Body = {
  subject?: string
  message?: string
  role?: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function buildTelLink(phone: string): string {
  const digits = phone.replaceAll(/[^+\d]/g, "")
  return digits ? `tel:${digits}` : "tel:+10000000000"
}

function loadBranding() {
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

  return {
    logoUrl,
    websiteUrl,
    appUrl,
    phone,
    phoneLink,
    supportEmail,
    instagramUrl,
    facebookUrl,
    tiktokUrl,
    instagramIcon,
    facebookIcon,
    tiktokIcon,
    googlePlayUrl,
    appStoreUrl,
    googlePlayBadge,
    appStoreBadge,
  }
}

function buildSupportHtml(
  params: {
    roleLabel: string
    roleShort: string
    userId: string
    userEmail: string
    subject: string
    message: string
  },
  b: ReturnType<typeof loadBranding>,
): string {
  const { roleLabel, roleShort, userId, userEmail, subject, message } = params
  const safeSubject = escapeHtml(subject)
  const safeMessage = escapeHtml(message)
  const safeRole = escapeHtml(roleLabel)
  const safeRoleShort = escapeHtml(roleShort)
  const safeEmail = escapeHtml(userEmail)
  const safeId = escapeHtml(userId)
  const year = new Date().getFullYear()

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Soporte GDN Style</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:32px 24px 24px;text-align:center;background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#312e81 100%);">
                <a href="${b.appUrl}" target="_blank" rel="noreferrer" style="text-decoration:none;">
                  <img src="${b.logoUrl}" alt="GDN Style" width="200" style="max-width:100%;height:auto;display:block;margin:0 auto 14px;" />
                </a>
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c9942f;">Bandeja de soporte</p>
                <p style="margin:0;font-size:15px;color:#e5e7eb;line-height:1.45;">Nuevo mensaje desde la app</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                  <tr>
                    <td style="vertical-align:middle;">
                      <h1 style="margin:0;font-size:22px;line-height:1.3;color:#111827;font-weight:700;">Solicitud de soporte</h1>
                      <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:#6b7280;">GDN Style · Ayuda y soporte</p>
                    </td>
                    <td style="width:1%;vertical-align:top;padding-left:12px;white-space:nowrap;">
                      <span style="display:inline-block;padding:8px 14px;background:linear-gradient(135deg,#fef9c3,#fde68a);border:1px solid #eab308;border-radius:999px;font-size:12px;font-weight:700;color:#713f12;">
                        ${safeRoleShort}
                      </span>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#fafafa 0%,#ffffff 100%);border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:18px;">
                  <tr>
                    <td style="padding:16px 18px;border-bottom:1px solid #f3f4f6;">
                      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;">Tipo de cuenta</p>
                      <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${safeRole}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width:50%;padding:14px 18px;border-right:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;vertical-align:top;">
                            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;">Email</p>
                            ${
                              userEmail && userEmail !== "(sin email)"
                                ? `<a href="mailto:${safeEmail}" style="font-size:14px;color:#2563eb;text-decoration:none;word-break:break-all;">${safeEmail}</a>`
                                : `<span style="font-size:14px;color:#9ca3af;">${safeEmail}</span>`
                            }
                          </td>
                          <td style="width:50%;padding:14px 18px;border-bottom:1px solid #f3f4f6;vertical-align:top;">
                            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;">ID de usuario</p>
                            <p style="margin:0;font-size:12px;font-family:Consolas,Monaco,monospace;color:#4b5563;word-break:break-all;">${safeId}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <div style="margin-bottom:18px;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;">Asunto</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-left:4px solid #c9942f;background:#fffbeb;border-radius:0 12px 12px 0;border:1px solid #fde68a;border-left-width:4px;border-left-color:#c9942f;">
                    <tr>
                      <td style="padding:14px 18px;">
                        <p style="margin:0;font-size:17px;font-weight:700;color:#78350f;line-height:1.35;">${safeSubject}</p>
                      </td>
                    </tr>
                  </table>
                </div>

                <div style="margin-bottom:22px;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;">Mensaje</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                    <tr>
                      <td style="padding:18px 20px;">
                        <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;white-space:pre-wrap;">${safeMessage}</p>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b7280;text-align:center;">
                  Telefono:
                  <a href="${b.phoneLink}" style="color:#2563eb;text-decoration:none;">${escapeHtml(b.phone)}</a>
                  | Email:
                  <a href="mailto:${escapeHtml(b.supportEmail)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(b.supportEmail)}</a>
                </p>
                <p style="margin:0 0 14px;text-align:center;">
                  <a href="${b.instagramUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${b.instagramIcon}" alt="Instagram" width="28" height="28" style="display:block;width:28px;height:28px;" />
                  </a>
                  <a href="${b.facebookUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${b.facebookIcon}" alt="Facebook" width="28" height="28" style="display:block;width:28px;height:28px;" />
                  </a>
                  <a href="${b.tiktokUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${b.tiktokIcon}" alt="TikTok" width="28" height="28" style="display:block;width:28px;height:28px;" />
                  </a>
                </p>
                <p style="margin:0 0 12px;text-align:center;">
                  <a href="${b.googlePlayUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${b.googlePlayBadge}" alt="Disponible en Google Play" height="40" style="display:block;height:40px;width:auto;" />
                  </a>
                  <a href="${b.appStoreUrl}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 6px;">
                    <img src="${b.appStoreBadge}" alt="Descargar en App Store" height="40" style="display:block;height:40px;width:auto;" />
                  </a>
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">
                  © ${year} GDN Style. Todos los derechos reservados.
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Configuración Supabase incompleta")
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("No authorization header")
    }

    const token = authHeader.replace("Bearer ", "")
    const supabase = createClient(supabaseUrl, serviceKey)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error("Usuario no autenticado")
    }

    // Cada mensaje sale por correo real (Resend). Cinco por hora y usuario es
    // más que suficiente para soporte legítimo y evita usar el formulario como
    // servicio de correo.
    if (!(await underRateLimit(supabase, `support:${user.id}`, 5, 3600))) {
      throw new Error("Demasiados mensajes. Espera unos minutos y vuelve a intentarlo.")
    }

    const payload = (await req.json()) as Body
    const subject = (payload.subject ?? "").trim()
    const message = (payload.message ?? "").trim()
    const role = payload.role === "provider" ? "provider" : "client"

    if (!subject || subject.length > 200) {
      throw new Error("Asunto inválido (1–200 caracteres)")
    }
    if (!message || message.length > 500) {
      throw new Error("Mensaje inválido (1–500 caracteres)")
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY")
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "GDN Style <no-reply@gdnstyle.com>"
    const supportInbox = Deno.env.get("SUPPORT_INBOX_EMAIL") ?? "support@gdnstyle.com"

    if (!resendApiKey) {
      throw new Error("Falta RESEND_API_KEY en variables de entorno")
    }

    const userEmail = user.email ?? ""
    const roleLabel = role === "provider" ? "Profesional (proveedor)" : "Cliente"
    const roleShort = role === "provider" ? "Profesional" : "Cliente"
    const mailSubject = `[GDN Soporte · ${roleLabel}] ${subject}`
    const branding = loadBranding()
    const html = buildSupportHtml(
      {
        roleLabel,
        roleShort,
        userId: user.id,
        userEmail: userEmail || "(sin email)",
        subject,
        message,
      },
      branding,
    )

    const resendBody: Record<string, unknown> = {
      from: fromEmail,
      to: [supportInbox],
      subject: mailSubject,
      html,
    }

    if (userEmail) {
      resendBody.reply_to = userEmail
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendBody),
    })

    const resendData = (await resendResponse.json()) as Record<string, unknown>
    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Error enviando el mensaje a soporte",
          details: resendData,
        }),
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
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
