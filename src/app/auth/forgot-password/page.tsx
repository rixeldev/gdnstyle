import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Solicita un enlace para restablecer tu contraseña de GDN Style.",
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
