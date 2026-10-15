"use client"

import Image from "next/image"
import { useId, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { ALL_CATEGORIES } from "@/constants/categories"
import { SERVICE_CATALOG } from "@/constants/services"
import { VENUES, VENUE_CITIES, type Venue } from "@/constants/venues"
import { useProviderVenueLinks } from "@/hooks/use-provider-links"
import { CATEGORY_ID_TO_NAME } from "@/libs/marketplace/adapt"
import { reloadCatalog } from "@/libs/marketplace/loader"
import { invalidateProviderLinks } from "@/libs/provider-links-store"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { createDatabaseVenueSchema, createVenueSchema } from "@/libs/validation/venue"
import { createVenue, updateVenue, type VenueDraft } from "@/libs/venue-store"
import { createProviderLocation, updateProviderLocation } from "@/services/provider.service"
import { cn } from "@/utils/cn"
import { fieldErrorsFrom } from "@/utils/zod"

interface VenueFormDialogProps {
  open: boolean
  /** `null` creates a new venue; a record edits it. */
  venue: Venue | null
  ownerId: string
  /** `providers.id` of the signed-in professional (database writes only). */
  providerId?: string | null
  onClose: () => void
  onSaved?: (venue: Venue) => void
}

const SERVICE_IDS = Object.keys(SERVICE_CATALOG)

const PHOTO_SETS = VENUES.map((venue, index) => ({
  id: venue.id,
  index: index + 1,
  image: venue.image,
  gallery: venue.gallery,
}))

interface FormState {
  name: string
  categoryId: string
  city: string
  area: string
  priceFrom: string
  services: string[]
  description: string
  phone: string
  whatsapp: string
  instagram: string
  image: string
  gallery: string[]
}

function initialValues(venue: Venue | null): FormState {
  return {
    name: venue?.name ?? "",
    categoryId: venue?.categoryId ?? ALL_CATEGORIES[0]?.id ?? "barberia",
    city: venue?.city ?? VENUE_CITIES[0] ?? "Manhattan",
    area: venue?.area ?? "",
    priceFrom: String(venue?.priceFrom ?? 50),
    services: venue ? [...venue.services] : [],
    description: venue?.description ?? "",
    phone: venue?.phone ?? "",
    whatsapp: venue?.whatsapp ?? "",
    instagram: venue?.instagram ?? "",
    image: venue?.image ?? PHOTO_SETS[0]?.image ?? "/venues/salon-aurora-1.jpg",
    gallery: venue?.gallery ?? PHOTO_SETS[0]?.gallery ?? ["/venues/salon-aurora-1.jpg"],
  }
}

/**
 * Create/edit venue modal used by the professional dashboard.
 *
 * Without Supabase it persists to the local store (services, price, contact…
 * all editable). With Supabase the database only stores the `locations` columns
 * (name/address/city/category/photos) plus the `provider_locations` link
 * (category/photos), so services/price/description/contact are hidden and an
 * existing venue only allows changing its category and photos.
 */
export function VenueFormDialog({
  open,
  venue,
  ownerId,
  providerId,
  onClose,
  onSaved,
}: VenueFormDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const [values, setValues] = useState<FormState>(() => initialValues(venue))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const supabase = getSupabaseBrowserClient()
  const cloud = Boolean(supabase)
  const { links } = useProviderVenueLinks()

  const isEdit = venue !== null
  const isDatabaseVenue = venue?.source === "database"
  const cloudEdit = cloud && isDatabaseVenue
  const link = isDatabaseVenue
    ? (links.find((item) => item.location_id === venue.id) ?? null)
    : null
  const cityOptions = venue && !VENUE_CITIES.includes(venue.city) ? [venue.city] : VENUE_CITIES

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function toggleService(serviceId: string) {
    setValues((current) => ({
      ...current,
      services: current.services.includes(serviceId)
        ? current.services.filter((id) => id !== serviceId)
        : [...current.services, serviceId],
    }))
  }

  function selectPhotoSet(image: string) {
    const set = PHOTO_SETS.find((item) => item.image === image)
    setValues((current) => ({
      ...current,
      image,
      gallery: set ? [...set.gallery] : current.gallery,
    }))
  }

  /** Database write: create a location, or update the provider's own link. */
  async function persistToDatabase(data: {
    name: string
    categoryId: string
    city: string
    area: string
    image: string
  }) {
    if (!supabase) return
    setSaving(true)
    try {
      const category = CATEGORY_ID_TO_NAME[data.categoryId] ?? data.categoryId

      if (cloudEdit) {
        if (!link) {
          toast(t("errors.generic"), "neutral")
          return
        }
        const updated = await updateProviderLocation(supabase, link.id, {
          category,
          image: data.image,
        })
        if (!updated) {
          toast(t("errors.generic"), "neutral")
          return
        }
        toast(t("venues.form.saved"))
      } else {
        if (!providerId) {
          toast(t("errors.generic"), "neutral")
          return
        }
        const id = await createProviderLocation(supabase, {
          providerId,
          name: data.name,
          address: data.area,
          city: data.city,
          category,
          image: data.image,
          imageAlt: values.gallery[1] ?? null,
        })
        if (!id) {
          toast(t("errors.generic"), "neutral")
          return
        }
        toast(t("venues.form.created"))
      }

      // Publish the fresh rows so the owned list and the directory/detail pick
      // the change up.
      invalidateProviderLinks()
      reloadCatalog()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (cloud) {
      const parsed = createDatabaseVenueSchema(t).safeParse(values)
      if (!parsed.success) {
        setErrors(fieldErrorsFrom(parsed.error))
        return
      }
      setErrors({})
      await persistToDatabase(parsed.data)
      return
    }

    const parsed = createVenueSchema(t).safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error))
      return
    }

    setErrors({})
    const data = parsed.data
    const clean = (value: string) => value.trim() || undefined
    const patch: Partial<Venue> & VenueDraft = {
      name: data.name,
      categoryId: data.categoryId,
      city: data.city,
      area: data.area,
      priceFrom: Math.round(data.priceFrom),
      services: data.services,
      description: clean(data.description),
      phone: clean(data.phone),
      whatsapp: clean(data.whatsapp),
      instagram: clean(data.instagram),
      image: data.image,
      gallery: values.gallery.length > 0 ? values.gallery : [data.image],
    }

    if (isEdit && venue) {
      updateVenue(venue.id, patch)
      onSaved?.({ ...venue, ...patch })
      toast(t("venues.form.saved"))
    } else {
      onSaved?.(createVenue(patch as VenueDraft, ownerId))
      toast(t("venues.form.created"))
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <div className="border-cream/10 flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {isEdit ? t("venues.form.editTitle") : t("venues.form.createTitle")}
            </h2>
            <p className="text-cream/50 mt-1 text-xs">
              {isEdit ? t("venues.form.editSubtitle") : t("venues.form.createSubtitle")}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          {cloud && (
            <p className="border-gold/25 bg-gold/5 text-gold-soft rounded-2xl border px-4 py-3 text-xs leading-relaxed">
              {cloudEdit ? t("venues.form.databaseEditHint") : t("venues.form.databaseHint")}
            </p>
          )}

          <TextField
            label={t("venues.form.name")}
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder={t("venues.form.namePlaceholder")}
            error={errors.name}
            disabled={cloudEdit}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="venue-category" className="text-cream/80 block text-sm font-medium">
                {t("venues.form.category")}
              </label>
              <Select
                id="venue-category"
                value={values.categoryId}
                options={ALL_CATEGORIES.map((category) => ({
                  value: category.id,
                  label: t(category.labelKey),
                }))}
                onChange={(value) => set("categoryId", value)}
                ariaLabel={t("venues.form.category")}
                className="w-full"
                triggerClassName="h-11 w-full rounded-xl pl-3.5 text-sm"
              />
              {errors.categoryId && (
                <p className="text-xs font-medium text-red-300">{errors.categoryId}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="venue-city" className="text-cream/80 block text-sm font-medium">
                {t("venues.form.city")}
              </label>
              <Select
                id="venue-city"
                value={values.city}
                options={cityOptions.map((city) => ({ value: city, label: city }))}
                onChange={(value) => set("city", value)}
                disabled={cloudEdit}
                ariaLabel={t("venues.form.city")}
                className="w-full"
                triggerClassName="h-11 w-full rounded-xl pl-3.5 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t("venues.form.area")}
              value={values.area}
              onChange={(event) => set("area", event.target.value)}
              placeholder={t("venues.form.areaPlaceholder")}
              error={errors.area}
              disabled={cloudEdit}
              required
            />
            {!cloud && (
              <TextField
                label={t("venues.form.priceFrom")}
                type="number"
                inputMode="numeric"
                min={0}
                value={values.priceFrom}
                onChange={(event) => set("priceFrom", event.target.value)}
                error={errors.priceFrom}
                required
              />
            )}
          </div>

          {!cloud && (
            <fieldset className="space-y-2">
              <legend className="text-cream/80 text-sm font-medium">
                {t("venues.form.services")}
              </legend>
              <p className="text-cream/45 text-xs">{t("venues.form.servicesHint")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICE_IDS.map((serviceId) => {
                  const checked = values.services.includes(serviceId)
                  return (
                    <label
                      key={serviceId}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition",
                        checked
                          ? "border-gold/50 bg-gold/10 text-cream"
                          : "border-cream/12 bg-cream/2 text-cream/70 hover:border-cream/25",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(serviceId)}
                        className="accent-gold size-4"
                      />
                      {t(`venues.services.${serviceId}`)}
                    </label>
                  )
                })}
              </div>
              {errors.services && (
                <p className="text-xs font-medium text-red-300">{errors.services}</p>
              )}
            </fieldset>
          )}

          {!cloud && (
            <>
              <div className="space-y-2">
                <label
                  htmlFor="venue-description"
                  className="text-cream/80 block text-sm font-medium"
                >
                  {t("venues.form.description")}
                </label>
                <textarea
                  id="venue-description"
                  value={values.description}
                  onChange={(event) => set("description", event.target.value)}
                  placeholder={t("venues.form.descriptionPlaceholder")}
                  rows={3}
                  className="border-cream/15 bg-cream/3 text-cream placeholder:text-cream/35 focus:border-gold/60 focus:bg-cream/5 w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm transition outline-none"
                />
                {errors.description && (
                  <p className="text-xs font-medium text-red-300">{errors.description}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label={t("venues.form.phone")}
                  value={values.phone}
                  onChange={(event) => set("phone", event.target.value)}
                  placeholder="+1 212 555 0100"
                  inputMode="tel"
                />
                <TextField
                  label={t("venues.form.whatsapp")}
                  value={values.whatsapp}
                  onChange={(event) => set("whatsapp", event.target.value)}
                  placeholder="+1 212 555 0100"
                  inputMode="tel"
                />
                <TextField
                  label={t("venues.form.instagram")}
                  value={values.instagram}
                  onChange={(event) => set("instagram", event.target.value)}
                  placeholder="@tusalon"
                />
              </div>
            </>
          )}

          <fieldset className="space-y-2">
            <legend className="text-cream/80 text-sm font-medium">{t("venues.form.photos")}</legend>
            <p className="text-cream/45 text-xs">{t("venues.form.photosHint")}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {PHOTO_SETS.map((set) => {
                const active = values.image === set.image
                return (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => selectPhotoSet(set.image)}
                    aria-pressed={active}
                    aria-label={t("venues.form.photoOption", { index: set.index })}
                    className={cn(
                      "relative h-16 overflow-hidden rounded-xl border transition",
                      active
                        ? "border-gold ring-gold/40 ring-2"
                        : "border-cream/12 hover:border-cream/30",
                    )}
                  >
                    <Image src={set.image} alt="" fill sizes="120px" className="object-cover" />
                    {active && (
                      <span className="bg-gold text-gold-ink absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {errors.image && <p className="text-xs font-medium text-red-300">{errors.image}</p>}
          </fieldset>
        </div>

        <div className="border-cream/10 flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? t("venues.form.save") : t("venues.form.create")}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
