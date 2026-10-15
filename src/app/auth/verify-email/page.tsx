import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { VerifyEmailNotice } from "@/components/auth/verify-email-notice"

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Confirm your email to activate your GDN Style account.",
}

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <VerifyEmailNotice />
    </AuthShell>
  )
}
