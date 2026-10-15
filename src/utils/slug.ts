import { normalize } from "@/utils/normalize"

/** URL slug for a display label ("Manhattan" → "manhattan"). */
export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
