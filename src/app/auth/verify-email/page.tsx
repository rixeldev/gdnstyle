import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { VerifyEmailNotice } from "@/components/auth/verify-email-notice"

export const metadata: Metadata = {
  title: "Confirma tu correo",
  description: "Confirma tu correo para activar tu cuenta de GDN Style.",
}

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <VerifyEmailNotice />
    </AuthShell>
  )
}
