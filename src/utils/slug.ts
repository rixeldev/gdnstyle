import { normalize } from "@/utils/normalize"

/** URL slug for a display label ("Santo Domingo" → "santo-domingo"). */
export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
