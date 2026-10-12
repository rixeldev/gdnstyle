import type { Venue } from "@/constants/venues"

/**
 * Test reviews for the venue detail pages. The text keys interpolate the
 * venue's first service (`{{service}}`) so the same pool works for every
 * record; `getVenueReviews` picks three from a deterministic offset.
 */
export interface VenueReview {
  id: string
  author: string
  rating: number
  textKey: string
}

const REVIEW_POOL: VenueReview[] = [
  { id: "r1", author: "Ana Lucía M.", rating: 5, textKey: "venues.reviews.pool.bookedPromptly" },
  { id: "r2", author: "Carolina F.", rating: 5, textKey: "venues.reviews.pool.exceeded" },
  { id: "r3", author: "Paola R.", rating: 4, textKey: "venues.reviews.pool.cleanFair" },
  { id: "r4", author: "Valeria S.", rating: 5, textKey: "venues.reviews.pool.neverFails" },
  { id: "r5", author: "Daniela P.", rating: 5, textKey: "venues.reviews.pool.onTime" },
  { id: "r6", author: "María José C.", rating: 4, textKey: "venues.reviews.pool.discovered" },
  { id: "r7", author: "Fernanda L.", rating: 5, textKey: "venues.reviews.pool.explained" },
  { id: "r8", author: "Gabriela T.", rating: 5, textKey: "venues.reviews.pool.flexible" },
  { id: "r9", author: "Estefanía V.", rating: 4, textKey: "venues.reviews.pool.ambience" },
  { id: "r10", author: "Renata D.", rating: 5, textKey: "venues.reviews.pool.recommended" },
  { id: "r11", author: "Camila O.", rating: 5, textKey: "venues.reviews.pool.clearPrice" },
  { id: "r12", author: "Isabella H.", rating: 5, textKey: "venues.reviews.pool.anotherLevel" },
]

/** Deterministic hash so every venue gets a stable, different selection. */
function hash(value: string): number {
  let total = 0
  for (let index = 0; index < value.length; index += 1) {
    total = (total + value.charCodeAt(index)) % 997
  }
  return total
}

export function getVenueReviews(venue: Venue): VenueReview[] {
  const start = hash(venue.id)
  return [0, 1, 2].map((offset) => REVIEW_POOL[(start + offset) % REVIEW_POOL.length])
}
