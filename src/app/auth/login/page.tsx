import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { VenueDirectory } from "@/components/venues/venue-directory"

export const metadata: Metadata = {
  title: "Explora locales de belleza",
  description:
    "Salones, barberías y estudios de belleza en GDN Style. Busca por nombre, servicio o ciudad y reserva cuando estés listo.",
}

/**
 * Blocking route: the whole page content (directory vs. sign-in form) depends
 * on the query string, so it renders on demand instead of being prerendered.
 */
export const instant = false

/**
 * The login route behaves like a marketplace directory (Vagaro/Booksy style):
 * visitors browse the indexed venues first and only reach the sign-in form
 * through `?auth=1`. A query in `?q=` pre-filters the directory.
 */
export default async function LoginPage({ searchParams }: PageProps<"/auth/login">) {
  const params = await searchParams
  const query = typeof params.q === "string" ? params.q : ""
  const showForm = params.auth === "1"

  if (!showForm) {
    return <VenueDirectory initialQuery={query} />
  }

  return (
    <AuthShell>
      <Suspense fallback={<AuthCardSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
