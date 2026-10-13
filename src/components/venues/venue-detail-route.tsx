"use client"

import { useTranslation } from "react-i18next"

import { ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Spinner } from "@/components/ui/spinner"
import { VenueDetail } from "@/components/venues/venue-detail"
import type { Venue } from "@/constants/venues"
import { useAllVenues } from "@/hooks/use-venues"
import { useIsClient } from "@/hooks/use-is-client"

interface VenueDetailRouteProps {
  /** Route param; may name a locally-created venue. */
  id: string
  /** Static record resolved on the server, or `null` for a local venue. */
  initialVenue: Venue | null
}

/**
 * Resolves the venue on the client so owner edits (and locally-created venues,
 * which never reach the server) are reflected on the page. The server snapshot
 * matches the prerendered record, so hydration stays stable; hidden venues stay
 * reachable here for the owner to preview.
 */
export function VenueDetailRoute({ id, initialVenue }: VenueDetailRouteProps) {
  const { t } = useTranslation()
  const venues = useAllVenues()
  const isClient = useIsClient()
  const venue = venues.find((item) => item.id === id) ?? initialVenue

  if (!venue) {
    // Local venues live in localStorage, so wait for the client snapshot before
    // deciding the record does not exist.
    if (!isClient) {
      return (
        <div className="text-cream/50 flex min-h-[40vh] items-center justify-center">
          <Spinner className="size-6" />
        </div>
      )
    }

    return (
      <div className="border-cream/10 bg-ink-card mx-auto my-16 max-w-lg rounded-3xl border p-10 text-center">
        <Icon name="search" className="text-gold mx-auto size-7" />
        <h1 className="font-display mt-4 text-2xl">{t("venues.notFound.title")}</h1>
        <p className="text-cream/55 mt-2 text-sm">{t("venues.notFound.body")}</p>
        <ButtonLink href="/venues" className="mt-6">
          {t("venues.notFound.cta")}
        </ButtonLink>
      </div>
    )
  }

  return <VenueDetail venue={venue} />
}
