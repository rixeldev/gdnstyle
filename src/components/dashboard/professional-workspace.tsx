"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button, ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { ProfileDialog } from "@/components/dashboard/profile-dialog"
import { ProviderAppointmentsSection } from "@/components/dashboard/provider-appointments-section"
import { VenueFormDialog } from "@/components/dashboard/venue-form-dialog"
import { getCategoryById } from "@/constants/categories"
import type { Venue } from "@/constants/venues"
import type { SessionUser } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  claimVenue,
  deleteVenue,
  isCustomVenueId,
  releaseVenue,
  setVenueHidden,
} from "@/libs/venue-store"
import { useAllVenues, useOwnedVenues } from "@/hooks/use-venues"
import { cn } from "@/utils/cn"
import { formatCurrency, toIntlLocale } from "@/utils/format"
import { initials } from "@/utils/initials"

interface ProfessionalWorkspaceProps {
  user: SessionUser
}

interface StatCard {
  key: string
  labelKey: string
  value: string
  icon: "map-pin" | "list" | "star" | "eye-off"
}

/**
 * Professional home: their profile plus the venues they own, editable end to
 * end (create, edit, hide, remove, and claim seed records).
 */
export function ProfessionalWorkspace({ user }: ProfessionalWorkspaceProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language ?? "es")
  const owned = useOwnedVenues()
  const allVenues = useAllVenues()
  // With Supabase the catalog is the source of truth, so the local hide/claim
  // actions (which only patch the local store) are not offered.
  const cloud = Boolean(getSupabaseBrowserClient())

  const [editingVenue, setEditingVenue] = useState<Venue | "new" | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<Venue | null>(null)

  const stats = useMemo<StatCard[]>(() => {
    const services = new Set<string>()
    let ratingTotal = 0
    let rated = 0
    let hidden = 0

    for (const venue of owned) {
      for (const serviceId of venue.services) services.add(serviceId)
      for (const service of venue.serviceList ?? []) services.add(service.id)
      if (venue.reviews > 0) {
        ratingTotal += venue.rating
        rated += 1
      }
      if (venue.hidden) hidden += 1
    }

    return [
      {
        key: "venues",
        labelKey: "dashboard.professional.statVenues",
        value: String(owned.length),
        icon: "map-pin",
      },
      {
        key: "services",
        labelKey: "dashboard.professional.statServices",
        value: String(services.size),
        icon: "list",
      },
      {
        key: "rating",
        labelKey: "dashboard.professional.statRating",
        value: rated > 0 ? (ratingTotal / rated).toFixed(1) : "—",
        icon: "star",
      },
      {
        key: "hidden",
        labelKey: "dashboard.professional.statHidden",
        value: String(hidden),
        icon: "eye-off",
      },
    ]
  }, [owned])

  const claimable = useMemo(
    () => (cloud ? [] : allVenues.filter((venue) => !venue.ownerId && !venue.hidden)),
    [allVenues, cloud],
  )

  const displayName = user.fullName ?? user.email ?? t("dashboard.professional.role")

  function toggleHidden(venue: Venue) {
    setVenueHidden(venue.id, !venue.hidden)
    toast(
      venue.hidden
        ? t("dashboard.professional.venueShown")
        : t("dashboard.professional.venueHiddenToast"),
    )
  }

  function handleRemove() {
    const venue = pendingRemove
    if (!venue) return
    if (isCustomVenueId(venue.id)) {
      deleteVenue(venue.id)
      toast(t("dashboard.professional.venueDeleted"))
    } else {
      releaseVenue(venue.id)
      toast(t("dashboard.professional.venueReleased"))
    }
    setPendingRemove(null)
  }

  function handleClaim(venue: Venue) {
    claimVenue(venue.id, user.id)
    toast(t("dashboard.professional.venueClaimed"))
  }

  const removingCustom = pendingRemove ? isCustomVenueId(pendingRemove.id) : false

  return (
    <div className="space-y-8">
      <section className="border-cream/10 bg-ink-card rounded-3xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="bg-gold/15 text-gold font-display flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold">
              {initials(displayName)}
            </span>
            <div className="min-w-0">
              <h2 className="font-display truncate text-xl">{displayName}</h2>
              {user.email && <p className="text-cream/55 mt-0.5 text-sm">{user.email}</p>}
              <div className="text-cream/65 mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="phone" className="text-gold size-4" />
                  {user.phone ?? t("dashboard.professional.noPhone")}
                </span>
              </div>
              <p className="text-cream/60 mt-3 max-w-xl text-sm leading-relaxed">
                {user.bio ?? t("dashboard.professional.noBio")}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setProfileOpen(true)}
            iconLeft={<Icon name="sliders" className="size-4" />}
          >
            {t("dashboard.professional.editProfile")}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.key} className="border-cream/10 bg-ink-card rounded-2xl border p-5">
            <Icon name={stat.icon} className="text-gold size-5" />
            <p className="font-display mt-3 text-3xl font-semibold">{stat.value}</p>
            <p className="text-cream/55 mt-1 text-xs tracking-[0.12em] uppercase">
              {t(stat.labelKey)}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">{t("dashboard.professional.venuesTitle")}</h2>
            <p className="text-cream/55 mt-1 max-w-xl text-sm">
              {t("dashboard.professional.venuesSubtitle")}
            </p>
          </div>
          <Button
            onClick={() => setEditingVenue("new")}
            iconLeft={<Icon name="sparkles" className="size-4" />}
          >
            {t("dashboard.professional.newVenue")}
          </Button>
        </div>

        {owned.length === 0 ? (
          <div className="border-cream/10 bg-ink-card rounded-3xl border border-dashed p-10 text-center">
            <Icon name="map-pin" className="text-gold mx-auto size-7" />
            <h3 className="font-display mt-4 text-lg">{t("dashboard.professional.emptyTitle")}</h3>
            <p className="text-cream/55 mx-auto mt-2 max-w-md text-sm">
              {t("dashboard.professional.emptyBody")}
            </p>
            <Button className="mt-5" onClick={() => setEditingVenue("new")}>
              {t("dashboard.professional.newVenue")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {owned.map((venue) => (
              <OwnedVenueCard
                key={venue.id}
                venue={venue}
                locale={locale}
                cloud={cloud}
                onEdit={() => setEditingVenue(venue)}
                onToggle={() => toggleHidden(venue)}
                onRemove={() => setPendingRemove(venue)}
              />
            ))}
          </div>
        )}
      </section>

      {claimable.length > 0 && (
        <details className="border-cream/10 bg-ink-card group rounded-3xl border p-5">
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
            {t("dashboard.professional.claimTitle", { count: claimable.length })}
            <Icon
              name="arrow-right"
              className="text-cream/50 size-4 transition group-open:rotate-90"
            />
          </summary>
          <p className="text-cream/55 mt-3 text-sm">{t("dashboard.professional.claimBody")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {claimable.map((venue) => (
              <div
                key={venue.id}
                className="border-cream/10 bg-cream/3 flex items-center gap-3 rounded-2xl border p-3"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-xl">
                  <Image src={venue.image} alt="" fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{venue.name}</p>
                  <p className="text-cream/50 truncate text-xs">
                    {venue.area}, {venue.city}
                  </p>
                </div>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => handleClaim(venue)}
                  aria-label={t("dashboard.professional.claimAction", { name: venue.name })}
                >
                  {t("dashboard.professional.claim")}
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}

      {editingVenue !== null && (
        <VenueFormDialog
          open
          venue={editingVenue === "new" ? null : editingVenue}
          ownerId={user.id}
          providerId={user.providerId}
          onClose={() => setEditingVenue(null)}
        />
      )}

      {cloud && user.providerId && <ProviderAppointmentsSection />}

      {profileOpen && <ProfileDialog open user={user} onClose={() => setProfileOpen(false)} />}

      <ConfirmDialog
        open={pendingRemove !== null}
        tone="danger"
        title={
          removingCustom
            ? t("dashboard.professional.removeTitle")
            : t("dashboard.professional.releaseTitle")
        }
        body={
          removingCustom
            ? t("dashboard.professional.removeBody", { name: pendingRemove?.name ?? "" })
            : t("dashboard.professional.releaseBody", { name: pendingRemove?.name ?? "" })
        }
        confirmLabel={
          removingCustom
            ? t("dashboard.professional.removeConfirm")
            : t("dashboard.professional.releaseConfirm")
        }
        onConfirm={handleRemove}
        onClose={() => setPendingRemove(null)}
      />
    </div>
  )
}

interface OwnedVenueCardProps {
  venue: Venue
  locale: string
  /** Database mode: hide/remove only exist in the local demo store. */
  cloud: boolean
  onEdit: () => void
  onToggle: () => void
  onRemove: () => void
}

function OwnedVenueCard({ venue, locale, cloud, onEdit, onToggle, onRemove }: OwnedVenueCardProps) {
  const { t } = useTranslation()
  const category = getCategoryById(venue.categoryId)
  const custom = isCustomVenueId(venue.id)
  const price = formatCurrency(venue.priceFrom, locale, "DOP", { maximumFractionDigits: 0 })
  const serviceCount = venue.serviceList?.length ?? venue.services.length

  return (
    <article className="border-cream/10 bg-ink-card flex flex-col gap-4 rounded-3xl border p-4">
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
          <Image src={venue.image} alt="" fill sizes="96px" className="object-cover" />
          {venue.hidden && <span className="bg-ink/70 absolute inset-0" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display truncate text-lg">{venue.name}</h3>
            {!cloud && (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  venue.hidden
                    ? "border-cream/20 text-cream/55"
                    : "border-gold/30 bg-gold/10 text-gold-soft",
                )}
              >
                {venue.hidden
                  ? t("dashboard.professional.hiddenBadge")
                  : t("dashboard.professional.activeBadge")}
              </span>
            )}
          </div>
          <p className="text-cream/55 mt-1 truncate text-sm">
            {category ? t(category.labelKey) : venue.categoryId} · {venue.area}, {venue.city}
          </p>
          <div className="text-cream/60 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="wallet" className="text-gold size-3.5" />
              {t("dashboard.professional.fromPrice", { price })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="list" className="text-gold size-3.5" />
              {t("dashboard.professional.serviceCount", { count: serviceCount })}
            </span>
          </div>
        </div>
      </div>

      <div className="border-cream/8 flex flex-wrap gap-2 border-t pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          iconLeft={<Icon name="sliders" className="size-4" />}
        >
          {t("dashboard.professional.editVenue")}
        </Button>
        <ButtonLink
          href={`/locales/${venue.id}`}
          variant="ghost"
          size="sm"
          iconLeft={<Icon name="arrow-up-right" className="size-4" />}
        >
          {t("dashboard.professional.viewVenue")}
        </ButtonLink>
        {!cloud && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              iconLeft={<Icon name={venue.hidden ? "eye" : "eye-off"} className="size-4" />}
            >
              {venue.hidden
                ? t("dashboard.professional.showVenue")
                : t("dashboard.professional.hideVenue")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-red-300 hover:text-red-200"
              iconLeft={<Icon name="trash" className="size-4" />}
            >
              {custom
                ? t("dashboard.professional.deleteVenue")
                : t("dashboard.professional.releaseVenue")}
            </Button>
          </>
        )}
      </div>
    </article>
  )
}
