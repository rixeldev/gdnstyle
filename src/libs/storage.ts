/**
 * SSR-safe localStorage helpers. All reads return the fallback on the server
 * or when storage is unavailable (private mode, blocked cookies, …).
 */
export const STORAGE_EVENT = "gdn:storage"

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export function readList<T>(key: string): T[] {
  const value = readStorage<T[] | null>(key, null)
  return Array.isArray(value) ? value : []
}

const listSnapshots = new Map<string, { raw: string | null; value: unknown[] }>()

/**
 * Stable-reference snapshot for `useSyncExternalStore`: the parsed array is
 * cached per key and only recreated when the raw string changes, so React can
 * bail out of notifications that carry the same data.
 */
export function readListSnapshot<T>(key: string): T[] {
  const fallback: T[] = []
  if (typeof window === "undefined") return fallback

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return fallback
  }

  const cached = listSnapshots.get(key)
  if (cached && cached.raw === raw) return cached.value as T[]

  let parsed: unknown = null
  try {
    parsed = raw === null ? null : JSON.parse(raw)
  } catch {
    parsed = null
  }

  const value = Array.isArray(parsed) ? (parsed as T[]) : fallback
  listSnapshots.set(key, { raw, value })
  return value
}

export function writeList<T>(key: string, items: T[]): void {
  writeStorage(key, items)
}

/** Dispatch a local event so every hook on the same page stays in sync. */
export function broadcastStorageChange(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT))
}

/** Simple unique-ish id for test records. */
export function createId(prefix: string): string {
  const stamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${stamp}${random}`
}
