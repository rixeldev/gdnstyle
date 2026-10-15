import type { Metadata } from "next"

import { FavoritesPage } from "@/components/venues/favorites-page"
import { VenueShell } from "@/components/venues/venue-shell"

export const metadata: Metadata = {
  title: "Your favorites",
  description: "The venues you saved on GDN Style, ready to book in one tap from your dashboard.",
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
