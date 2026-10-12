import type { Metadata } from "next"

import { VenueShell } from "@/components/venues/venue-shell"
import { VenueDirectory } from "@/components/venues/venue-directory"

export const metadata: Metadata = {
  title: "Explora locales de belleza",
  description:
    "Salones, barberías y estudios de belleza en GDN Style. Busca por nombre, servicio o ciudad y reserva cuando estés listo.",
}

/**
 * Blocking route: the directory content depends on the query string (`?q=`),
 * so it renders on demand instead of being prerendered.
 */
export const instant = false

interface LocalesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Marketplace venue directory (Vagaro/Booksy style) with test records for now. */
export default async function LocalesPage({ searchParams }: LocalesPageProps) {
  const params = await searchParams
  const query = typeof params.q === "string" ? params.q : ""

  return (
    <VenueShell>
      <VenueDirectory initialQuery={query} syncUrl />
    </VenueShell>
  )
}
