import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { VenueShell } from "@/components/venues/venue-shell"
import { VenueDetail } from "@/components/venues/venue-detail"
import { VENUES } from "@/constants/venues"

interface VenuePageProps {
  params: Promise<{ id: string }>
}

/** Prerender the test records; unknown ids fall back to a dynamic 404. */
export function generateStaticParams() {
  return VENUES.map((venue) => ({ id: venue.id }))
}

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const { id } = await params
  const venue = VENUES.find((item) => item.id === id)

  if (!venue) {
    return { title: "Local no encontrado" }
  }

  return {
    title: venue.name,
    description: `${venue.name}, ${venue.area}, ${venue.city}. Reserva tu cita en GDN Style.`,
  }
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { id } = await params
  const venue = VENUES.find((item) => item.id === id)

  if (!venue) notFound()

  return (
    <VenueShell>
      <VenueDetail venue={venue} />
    </VenueShell>
  )
}
