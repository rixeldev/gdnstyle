import { z } from "zod"

type Translate = (key: string) => string

/** Validation for the professional's create/edit venue form. */
export function createVenueSchema(t: Translate) {
  return z.object({
    name: z.string().trim().min(2, t("validation.venueNameMin")),
    categoryId: z.string().min(1, t("validation.venueCategoryRequired")),
    city: z.string().trim().min(2, t("validation.venueCityRequired")),
    area: z.string().trim().min(2, t("validation.venueAreaRequired")),
    priceFrom: z.coerce.number().min(0, t("validation.venuePriceMin")),
    services: z.array(z.string()).min(1, t("validation.venueServicesRequired")),
    description: z.string().trim().max(400, t("validation.venueDescriptionMax")),
    phone: z.string().trim(),
    whatsapp: z.string().trim(),
    instagram: z.string().trim(),
    image: z.string().min(1, t("validation.venuePhotoRequired")),
  })
}

export type VenueFormValues = z.infer<ReturnType<typeof createVenueSchema>>

/**
 * A latitude or longitude as typed. Blank is valid -- a venue does not have to
 * be on the map yet -- but anything else has to be a finite number inside its
 * real range, and it reaches the database as `number | null` rather than the
 * string the input holds.
 */
function coordinate(t: Translate, bounds: { min: number; max: number }) {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (Number.isFinite(Number(value)) &&
          Number(value) >= bounds.min &&
          Number(value) <= bounds.max),
      t("validation.venueCoordinateInvalid"),
    )
    .transform((value) => (value === "" ? null : Number(value)))
}

/**
 * Validation for a database-backed venue: everything the `locations` row
 * stores (name, address, city, state, country, ZIP, coordinates, category and
 * photos). Services, price, description and contact stay out of it -- they are
 * provider columns, not location columns.
 */
export function createDatabaseVenueSchema(t: Translate) {
  return z.object({
    name: z.string().trim().min(2, t("validation.venueNameMin")),
    categoryId: z.string().min(1, t("validation.venueCategoryRequired")),
    city: z.string().trim().min(2, t("validation.venueCityRequired")),
    area: z.string().trim().min(2, t("validation.venueAreaRequired")),
    state: z.string().trim(),
    country: z.string().trim(),
    postalCode: z.string().trim(),
    latitude: coordinate(t, { min: -90, max: 90 }),
    longitude: coordinate(t, { min: -180, max: 180 }),
    image: z.string().min(1, t("validation.venuePhotoRequired")),
  })
}
