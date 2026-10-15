/**
 * Built-in demo authentication.
 *
 * Supabase is optional in this project, so every gated action also needs a
 * working session when the database is not connected. This module keeps a small
 * localStorage-backed user store and session that mirrors the shape of a real
 * provider response, letting the marketplace (bookings, favorites, reviews,
 * dashboard) be reviewed end to end with the credentials below.
 *
 * When Supabase *is* configured the auth service ignores this layer and talks to
 * the real provider instead.
 */
import type { UserRole } from "@/interfaces/auth"
import { broadcastStorageChange, readStorage, writeStorage } from "@/libs/storage"

const SESSION_KEY = "gdn.session"
const USERS_KEY = "gdn.users"
const PROFILES_KEY = "gdn.profiles"

export type DemoAuthMethod = "password" | "google"

export interface DemoUser {
  id: string
  email: string
  password: string
  role: UserRole
  fullName: string
  phone?: string
  bio?: string
  avatarUrl?: string | null
  /** Professional onboarding extras (mirror the `providers` columns). */
  city?: string
  instagram?: string
  tiktok?: string
}

/** Account persisted once a visitor signs in (never stores the password). */
export interface DemoSession {
  id: string
  email: string
  role: UserRole
  fullName: string
  avatarUrl: string | null
  phone?: string | null
  bio?: string | null
  method: DemoAuthMethod
}

/** Fields a professional can edit from their dashboard. */
export interface DemoProfilePatch {
  fullName?: string
  phone?: string | null
  bio?: string | null
  avatarUrl?: string | null
}

/** Seed accounts documented in the UI so reviewers can sign in instantly. */
export const DEMO_USERS: DemoUser[] = [
  {
    id: "demo-client",
    email: "client@gdnstyle.com",
    password: "@Gs_123456",
    role: "customer",
    fullName: "Ana Pérez",
  },
  {
    id: "demo-professional",
    email: "professional@gdnstyle.com",
    password: "@Gs_123456",
    role: "professional",
    fullName: "Valeria Núñez",
  },
]

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function readCustomUsers(): DemoUser[] {
  const stored = readStorage<DemoUser[]>(USERS_KEY, [])
  return Array.isArray(stored) ? stored.filter(Boolean) : []
}

function readProfiles(): Record<string, DemoProfilePatch> {
  const stored = readStorage<Record<string, DemoProfilePatch>>(PROFILES_KEY, {})
  return stored && typeof stored === "object" ? stored : {}
}

/** Stored profile edits for a demo user (empty when never edited). */
export function demoProfile(userId: string): DemoProfilePatch {
  return readProfiles()[userId] ?? {}
}

/**
 * Persist profile edits. When the edited user is the one signed in, the open
 * session is refreshed too so the dashboard reflects the change immediately.
 */
export function saveDemoProfile(userId: string, patch: DemoProfilePatch): void {
  writeStorage(PROFILES_KEY, { ...readProfiles(), [userId]: { ...demoProfile(userId), ...patch } })

  const session = readDemoSession()
  if (session && session.id === userId) {
    writeDemoSession({
      ...session,
      fullName: patch.fullName ?? session.fullName,
      phone: patch.phone !== undefined ? patch.phone : (session.phone ?? null),
      bio: patch.bio !== undefined ? patch.bio : (session.bio ?? null),
      avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : session.avatarUrl,
    })
    return
  }

  broadcastStorageChange()
}

/** Seed accounts plus any locally-registered ones, with profile edits applied. */
export function listDemoUsers(): DemoUser[] {
  return [...DEMO_USERS, ...readCustomUsers()].map((user) => {
    const profile = demoProfile(user.id)
    return {
      ...user,
      fullName: profile.fullName ?? user.fullName,
      phone: profile.phone ?? user.phone,
      bio: profile.bio ?? user.bio,
    }
  })
}

export function readDemoSession(): DemoSession | null {
  const session = readStorage<DemoSession | null>(SESSION_KEY, null)
  return session && session.id ? session : null
}

export function writeDemoSession(session: DemoSession | null): void {
  writeStorage(SESSION_KEY, session)
  broadcastStorageChange()
}

export function clearDemoSession(): void {
  writeDemoSession(null)
}

/** Validate credentials against the local user store and start a session. */
export function authenticateDemo(email: string, password: string): DemoSession | null {
  const match = listDemoUsers().find((user) => user.email === normalizeEmail(email))
  if (!match || match.password !== password) return null

  const session: DemoSession = {
    id: match.id,
    email: match.email,
    role: match.role,
    fullName: match.fullName,
    phone: match.phone ?? null,
    bio: match.bio ?? null,
    avatarUrl: match.avatarUrl ?? null,
    method: "password",
  }
  writeDemoSession(session)
  return session
}

export interface DemoSignUpInput {
  email: string
  password: string
  fullName: string
  role: UserRole
  phone?: string
  city?: string
  instagram?: string
  tiktok?: string
}

export interface DemoSignUpResult {
  ok: boolean
  errorCode?: string
  session?: DemoSession
}

/** Create a local account and sign it in (demo mode skips email confirmation). */
export function registerDemoUser(input: DemoSignUpInput): DemoSignUpResult {
  const email = normalizeEmail(input.email)

  if (listDemoUsers().some((user) => user.email === email)) {
    return { ok: false, errorCode: "user_already_exists" }
  }

  const user: DemoUser = {
    id: `demo-${email.replace(/[^a-z0-9]+/g, "-")}`,
    email,
    password: input.password,
    role: input.role,
    fullName: input.fullName.trim(),
    phone: input.phone?.trim() || undefined,
    city: input.city?.trim() || undefined,
    instagram: input.instagram?.trim() || undefined,
    tiktok: input.tiktok?.trim() || undefined,
  }

  writeStorage(USERS_KEY, [...readCustomUsers(), user])

  const session: DemoSession = {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone ?? null,
    bio: null,
    avatarUrl: null,
    method: "password",
  }
  writeDemoSession(session)

  return { ok: true, session }
}

/**
 * Demo replacement for the Google OAuth round trip. It signs into the seed
 * account for the selected role so the dashboard and role-specific modules stay
 * coherent.
 */
export function googleDemoSession(role: UserRole): DemoSession {
  const base = role === "professional" ? DEMO_USERS[1] : DEMO_USERS[0]
  const session: DemoSession = {
    id: base.id,
    email: base.email,
    role: base.role,
    fullName: base.fullName,
    phone: base.phone ?? null,
    bio: base.bio ?? null,
    avatarUrl: null,
    method: "google",
  }
  writeDemoSession(session)
  return session
}
