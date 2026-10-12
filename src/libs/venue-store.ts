/**
 * Local venue overlay.
 *
 * Supabase is optional in this project, so the professional's venue management
 * (create, edit, hide, remove, claim) is persisted in localStorage and merged
 * over the static test records in `@/constants/venues`. Every client component
 * that lists venues reads the merged view, so a professional's changes show up
 * across the marketplace (directory, search, favorites, venue page) while the
 * base records stay untouched.
 *
 * Ownership lives on `Venue.ownerId`: the seed records claim a couple of venues
 * for the demo professional, and venues created here are stamped with the
 * owner. `releaseVenue` clears it through the edits map (empty string sentinel,
 * because JSON drops `undefined`).
 */
import { VENUES, type Venue } from "@/constants/venues"
import { broadcastStorageChange, createId, readStorage, writeStorage } from "@/libs/storage"

const CUSTOM_KEY = "gdn.venues.custom"
const EDITS_KEY = "gdn.venues.edits"

/** Venues created here use this prefix so the venue route can tell them apart. */
export const CUSTOM_VENUE_PREFIX = "custom-"

/** Fields the professional fills in when creating or editing a venue. */
export interface VenueDraft {
  name: string
  categoryId: string
  city: string
  area: string
  priceFrom: number
  services: string[]
  description?: string
  phone?: string
  whatsapp?: string
  instagram?: string
  image: string
  gallery: string[]
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function readCustomVenues(): Venue[] {
  const stored = readStorage<Venue[]>(CUSTOM_KEY, [])
  return Array.isArray(stored) ? stored.filter((item) => Boolean(item?.id)) : []
}

function readVenueEdits(): Record<string, Partial<Venue>> {
  const stored = readStorage<Record<string, Partial<Venue>>>(EDITS_KEY, {})
  return stored && typeof stored === "object" ? stored : {}
}

function writeCustomVenues(items: Venue[]): void {
  writeStorage(CUSTOM_KEY, items)
  broadcastStorageChange()
}

function writeVenueEdits(edits: Record<string, Partial<Venue>>): void {
  writeStorage(EDITS_KEY, edits)
  broadcastStorageChange()
}

function applyEdits(venue: Venue, edits: Record<string, Partial<Venue>>): Venue {
  return { ...venue, ...edits[venue.id] }
}

/** Static plus custom records, with owner edits applied (hidden included). */
export function mergeVenues(): Venue[] {
  const edits = readVenueEdits()
  return [
    ...VENUES.map((venue) => applyEdits(venue, edits)),
    ...readCustomVenues().map((venue) => applyEdits(venue, edits)),
  ]
}

let cache: { key: string; value: Venue[] } | null = null

/** Signature of the two localStorage blobs; changes invalidate the snapshot. */
function signature(): string {
  if (typeof window === "undefined") return "server"
  try {
    const custom = window.localStorage.getItem(CUSTOM_KEY) ?? ""
    const edits = window.localStorage.getItem(EDITS_KEY) ?? ""
    return `${custom}::${edits}`
  } catch {
    return "server"
  }
}

/** Stable merged snapshot for `useSyncExternalStore` (client). */
export function venuesSnapshot(): Venue[] {
  const key = signature()
  if (cache && cache.key === key) return cache.value
  const value = mergeVenues()
  cache = { key, value }
  return value
}

/** Base records shown on the server and during hydration. */
export function venuesServerSnapshot(): Venue[] {
  return VENUES
}

/** Coordinates for a city, averaged from known venues (custom venues need a pin). */
export function coordsForCity(city: string): { lat: number; lon: number } {
  const matches = VENUES.filter((venue) => venue.city === city)
  if (matches.length === 0) return { lat: 18.4861, lon: -69.9312 }
  return {
    lat: matches.reduce((sum, venue) => sum + venue.lat, 0) / matches.length,
    lon: matches.reduce((sum, venue) => sum + venue.lon, 0) / matches.length,
  }
}

export function isCustomVenueId(id: string): boolean {
  return id.startsWith(CUSTOM_VENUE_PREFIX)
}

/** Create a venue owned by `ownerId` (starts with no reviews). */
export function createVenue(draft: VenueDraft, ownerId: string): Venue {
  const { lat, lon } = coordsForCity(draft.city)
  const venue: Venue = {
    id: createId(CUSTOM_VENUE_PREFIX.slice(0, -1)),
    name: draft.name.trim(),
    categoryId: draft.categoryId,
    city: draft.city.trim(),
    area: draft.area.trim(),
    rating: 5,
    reviews: 0,
    priceFrom: draft.priceFrom,
    services: [...draft.services],
    image: draft.image,
    gallery: [...draft.gallery],
    lat,
    lon,
    ownerId,
    description: clean(draft.description),
    phone: clean(draft.phone),
    whatsapp: clean(draft.whatsapp),
    instagram: clean(draft.instagram),
    hidden: false,
  }
  writeCustomVenues([...readCustomVenues(), venue])
  return venue
}

/** Patch a venue: custom records are edited in place, seed records via the edits map. */
export function updateVenue(id: string, patch: Partial<Venue>): void {
  const custom = readCustomVenues()
  if (custom.some((venue) => venue.id === id)) {
    writeCustomVenues(custom.map((venue) => (venue.id === id ? { ...venue, ...patch } : venue)))
    return
  }
  writeVenueEdits({ ...readVenueEdits(), [id]: { ...readVenueEdits()[id], ...patch } })
}

/** Remove a venue created by the professional. */
export function deleteVenue(id: string): void {
  writeCustomVenues(readCustomVenues().filter((venue) => venue.id !== id))
}

/** Show or hide a venue in the public directory. */
export function setVenueHidden(id: string, hidden: boolean): void {
  updateVenue(id, { hidden })
}

/** Attach a seed venue to the professional. */
export function claimVenue(id: string, ownerId: string): void {
  updateVenue(id, { ownerId })
}

/** Detach a seed venue from the professional (stays public, unowned). */
export function releaseVenue(id: string): void {
  updateVenue(id, { ownerId: "" })
}
