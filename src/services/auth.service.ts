import type { AuthResult, Credentials, Profile, SignUpInput, UserRole } from "@/interfaces/auth"
import {
  authenticateDemo,
  clearDemoSession,
  googleDemoSession,
  registerDemoUser,
  saveDemoProfile,
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
    })
    return result.ok ? { ok: true } : { ok: false, errorCode: result.errorCode }
  }

  const { error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo,
      data: { role: input.role, full_name: input.fullName.trim() },
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

export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable

  const { error } = await supabase.auth.updateUser({ password })
  return normalize(error)
}

export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (supabase) await supabase.auth.signOut()
  clearDemoSession()
  return { ok: true }
}

/** Fields a signed-in professional can edit from their dashboard. */
export interface ProfileUpdate {
  fullName?: string
  phone?: string | null
  bio?: string | null
}

/**
 * Update the current user's profile. Uses the local demo profile store without
 * Supabase (so the professional dashboard is editable end to end), and the
 * `profiles` table when configured. `bio` is demo-only for now.
 */
export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    saveDemoProfile(userId, patch)
    return { ok: true }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: patch.fullName, phone: patch.phone })
    .eq("id", userId)

  return normalize(error)
}

/** Fetch the current user's profile row (RLS lets users read only their own). */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null

  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, phone, avatar_url, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    role: data.role === "professional" ? "professional" : "customer",
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
