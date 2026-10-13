import type { Metadata } from "next"

import { FavoritesPage } from "@/components/venues/favorites-page"
import { VenueShell } from "@/components/venues/venue-shell"

export const metadata: Metadata = {
  title: "Tus favoritos",
  description:
    "Los locales que guardaste en GDN Style, listos para reservar en un toque desde tu panel.",
  alternates: { canonical: "/favorites" },
}

/** Saved venues page. Favourites come from the session, so this renders on the client. */
export default function FavoritesRoute() {
  return (
    <VenueShell>
      <FavoritesPage />
    </VenueShell>
  )
}
