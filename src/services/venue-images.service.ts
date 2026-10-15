import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Marketplace photos live in this public bucket -- `next.config.ts` allow-lists
 * it for `next/image`, and every venue image already served from it.
 */
const VENUE_IMAGE_BUCKET = "portfolio"

/** Accepted types, and the stored extension for each (never the file name). */
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

/** Same ceiling the portfolio upload enforces, in bytes. */
const MAX_BYTES = 5 * 1024 * 1024

/** `rejected` = the file itself is not acceptable; `upload` = Storage refused. */
export type VenueImageUploadError = "rejected" | "upload"

export type VenueImageUploadResult = { url: string } | { error: VenueImageUploadError }

/**
 * Store the professional's own venue photo and return its public URL.
 *
 * This one uploads from the browser, unlike every other upload in the app,
 * which goes through an Edge Function holding the service role: migration 0006
 * adds the matching `storage.objects` insert policy, so the feature needs no
 * function deploy to go live. The path is `venues/<provider id>/<timestamp>` --
 * a brand-new object every time, so nothing is ever overwritten and no update
 * or delete policy is required.
 */
export async function uploadVenueImage(
  client: SupabaseClient,
  providerId: string,
  file: File,
): Promise<VenueImageUploadResult> {
  const extension = EXTENSION_BY_TYPE[file.type]
  if (!extension) return { error: "rejected" }
  if (file.size > MAX_BYTES) return { error: "rejected" }

  const path = `venues/${providerId}/${Date.now()}.${extension}`
  const { error } = await client.storage
    .from(VENUE_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) {
    console.error("[venue images] failed to upload the photo", error)
    return { error: "upload" }
  }

  const { data } = client.storage.from(VENUE_IMAGE_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}
