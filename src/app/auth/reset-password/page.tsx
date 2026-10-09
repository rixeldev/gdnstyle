import type { Metadata } from "next"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata: Metadata = {
  title: "Nueva contraseña",
  description: "Elige una nueva contraseña para tu cuenta de GDN Style.",
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
