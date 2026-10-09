import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton"
import { SignUpForm } from "@/components/auth/signup-form"

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta en GDN Style como cliente o profesional.",
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <SignUpForm />
    </Suspense>
  )
}
