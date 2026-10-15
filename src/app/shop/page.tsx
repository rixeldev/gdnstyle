import type { Metadata } from "next"

import { ShopPage } from "@/components/shop/shop-page"
import { VenueShell } from "@/components/venues/venue-shell"

export const metadata: Metadata = {
  title: "Shop",
  description: "Hand-picked GDN Style products, with secure checkout and home delivery.",
  alternates: { canonical: "/shop" },
}

/** Storefront page: the catalog is read on the client from `products`. */
export default function ShopRoute() {
  return (
    <VenueShell>
      <ShopPage />
    </VenueShell>
  )
}
