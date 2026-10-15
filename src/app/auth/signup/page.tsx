import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton"
import { AuthShell } from "@/components/auth/auth-shell"
import { SignUpForm } from "@/components/auth/signup-form"

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your GDN Style account as a client or a professional.",
}

export default function SignUpPage() {
  return (
    <AuthShell>
      <Suspense fallback={<AuthCardSkeleton />}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  )
}
