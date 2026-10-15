import type { Metadata } from "next"

import { VenueShell } from "@/components/venues/venue-shell"
import { VenueDirectory } from "@/components/venues/venue-directory"
import { getServerCatalog } from "@/libs/marketplace/server"

export const metadata: Metadata = {
  title: "Explore beauty venues",
  description:
    "Salons, barbershops and beauty studios on GDN Style. Search by name, service or city and book when you're ready.",
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
