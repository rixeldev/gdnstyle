import type { Metadata } from "next"

import { VenueShell } from "@/components/venues/venue-shell"
import { VenueDirectory } from "@/components/venues/venue-directory"
import { getServerCatalog } from "@/libs/marketplace/server"

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

interface VenuesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Marketplace venue directory backed by the live Supabase catalog. */
export default async function VenuesPage({ searchParams }: VenuesPageProps) {
  const params = await searchParams
  const query = typeof params.q === "string" ? params.q : ""
  const venues = await getServerCatalog()

  return (
    <VenueShell>
      <VenueDirectory initialQuery={query} initialVenues={venues} syncUrl />
    </VenueShell>
  )
}
