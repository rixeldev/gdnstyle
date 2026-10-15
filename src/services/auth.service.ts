import type {
  AccountAddress,
  AuthResult,
  Credentials,
  Profile,
  SignUpInput,
  UserRole,
} from "@/interfaces/auth"
import {
  authenticateDemo,
  clearDemoSession,
  googleDemoSession,
  registerDemoUser,
  saveDemoProfile,
  updateDemoPassword,
} from "@/libs/auth/demo"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"

type SupabaseError = { message?: string; code?: string; status?: number } | null

function normalize(error: SupabaseError): AuthResult {
  if (!error) return { ok: true }
  return { ok: false, errorCode: error.code, message: error.message }
}

const unavailable: AuthResult = { ok: false, errorCode: "unavailable" }

export async function signInWithPassword({ email, password }: Credentials): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return authenticateDemo(email, password)
      ? { ok: true }
      : { ok: false, errorCode: "invalid_credentials" }
  }

  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return normalize(error)
}

/**
 * Google OAuth. Falls back to the built-in demo session when Supabase is not
 * configured so the button works during review.
 */
export async function signInWithGoogle(role: UserRole, redirectTo: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    googleDemoSession(role)
    return { ok: true }
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  })

  return normalize(error)
}

export async function signUpWithPassword(
  input: SignUpInput,
  emailRedirectTo?: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    const result = registerDemoUser({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      role: input.role,
      phone: input.phone,
      city: input.city,
      instagram: input.instagram,
      tiktok: input.tiktok,
    })
    return result.ok ? { ok: true } : { ok: false, errorCode: result.errorCode }
  }

  const { error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo,
      // The `handle_new_user` trigger (migration 0002) validates `role`
      // against the `roles` catalog, creates the profile row and — for
      // professionals — their `providers` row with the onboarding extras.
      data: {
        role: input.role,
        full_name: input.fullName.trim(),
        phone: input.phone?.trim() ?? "",
        city: input.city?.trim() ?? "",
        instagram: input.instagram?.trim() ?? "",
        tiktok: input.tiktok?.trim() ?? "",
      },
    },
  })

  return normalize(error)
}

export async function resendConfirmationEmail(
  email: string,
  emailRedirectTo?: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo },
  })

  return normalize(error)
}

export async function sendPasswordReset(email: string, redirectTo: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  return normalize(error)
}

/**
 * Set a new password for a signed-in account. Supabase has no "confirm the old
 * one" call, so the account dialog verifies the current password first (a
 * `signInWithPassword` with the same email) and this only applies the new one.
 * Without a backend, `demoUserId` names the local account to update; callers
 * that have no session to speak of (the reset-password flow) leave it out and
 * keep getting `unavailable`.
 */
export async function updatePassword(password: string, demoUserId?: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    if (!demoUserId) return unavailable
    updateDemoPassword(demoUserId, password)
    return { ok: true }
  }

  const { error } = await supabase.auth.updateUser({ password })
  return normalize(error)
}

/**
 * End the session. `global` also ends every other session of the account, which
 * is what the account dialog's "sign out of all devices" asks for.
 */
export async function signOut(scope: "local" | "global" = "local"): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (supabase) await supabase.auth.signOut(scope === "global" ? { scope: "global" } : undefined)
  clearDemoSession()
  return { ok: true }
}

/** Fields a signed-in user can edit from the account dialog. */
export interface ProfileUpdate {
  fullName?: string
  phone?: string | null
  bio?: string | null
  /** Where a customer lives. Professionals keep theirs on the `providers` row. */
  address?: AccountAddress
}

/**
 * Update the current user's profile. Uses the local demo profile store without
 * Supabase (so the dashboard is editable end to end), and the `profiles` table
 * when configured. Only the keys present in the patch are written, so a partial
 * update never blanks a column.
 */
export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    saveDemoProfile(userId, patch)
    return { ok: true }
  }

  const row: Record<string, unknown> = {}
  if (patch.fullName !== undefined) row.full_name = patch.fullName
  if (patch.phone !== undefined) row.phone = patch.phone
  if (patch.bio !== undefined) row.bio = patch.bio
  if (patch.address) {
    row.address_line1 = patch.address.line1
    row.address_line2 = patch.address.line2
    row.address_city = patch.address.city
    row.address_state = patch.address.state
    row.address_postal_code = patch.address.postalCode
    row.address_country = patch.address.country
  }

  const { error } = await supabase.from("profiles").update(row).eq("id", userId)

  return normalize(error)
}

/**
 * Permissions granted by a role row (`roles` catalog, migration 0002).
 * Returns an empty list when the table is missing so callers fall back to
 * the static map instead of breaking the session.
 */
export async function fetchRolePermissions(role: string): Promise<string[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return []

  const { data } = await supabase.from("roles").select("permissions").eq("key", role).maybeSingle()

  return Array.isArray(data?.permissions) ? (data.permissions as string[]) : []
}

/**
 * Fetch the current user's profile row (RLS lets users read only their own).
 * `bio` and the `address_*` columns come from migration 0007: a database that
 * has not applied it fails this select, and the session falls back to the
 * static role map instead of breaking.
 */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null

  const { data } = await supabase
    .from("profiles")
    .select(
      "id,role,full_name,email,phone,bio,avatar_url,address_line1,address_line2,address_city,address_state,address_postal_code,address_country,created_at,updated_at",
    )
    .eq("id", userId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    // `role` is a foreign key into the `roles` catalog; the UI ships two
    // flows, so any other value (e.g. admin) renders the customer one.
    role: data.role === "professional" ? "professional" : "customer",
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    bio: data.bio,
    address: {
      line1: data.address_line1,
      line2: data.address_line2,
      city: data.address_city,
      state: data.address_state,
      postalCode: data.address_postal_code,
      country: data.address_country,
    },
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
