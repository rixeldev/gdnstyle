import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to GDN Style as a client or a professional.",
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<AuthCardSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
