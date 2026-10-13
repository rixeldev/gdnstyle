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
 * Validation for a database-backed venue. Only `locations` columns can be
 * stored (name/address/city/category/photos), so services, price, description
 * and contact fields are not part of the schema.
 */
export function createDatabaseVenueSchema(t: Translate) {
  return z.object({
    name: z.string().trim().min(2, t("validation.venueNameMin")),
    categoryId: z.string().min(1, t("validation.venueCategoryRequired")),
    city: z.string().trim().min(2, t("validation.venueCityRequired")),
    area: z.string().trim().min(2, t("validation.venueAreaRequired")),
    image: z.string().min(1, t("validation.venuePhotoRequired")),
  })
}
