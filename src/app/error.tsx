"use client"

import Link from "next/link"

/**
 * Root error boundary. Keeps the brand frame around any unexpected failure
 * while offering a retry instead of a blank page.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Errors are logged by Next.js; keep the client message generic.
  void error

  return (
    <div className="bg-ink text-cream flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-gold text-sm tracking-[0.28em] uppercase">GDN Style</p>
      <h1 className="font-display mt-4 text-3xl font-semibold md:text-4xl">Algo salió mal</h1>
      <p className="text-cream/60 mt-3 max-w-sm text-sm">
        Ocurrió un error inesperado. Puedes volver a intentarlo o regresar al inicio.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-gold text-gold-ink hover:bg-gold-soft inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="border-cream/20 text-cream hover:border-cream/50 inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-semibold transition"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
