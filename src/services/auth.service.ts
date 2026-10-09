import type { AuthResult, Credentials, Profile, SignUpInput } from "@/interfaces/auth"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"

type SupabaseError = { message?: string; code?: string; status?: number } | null

function normalize(error: SupabaseError): AuthResult {
  if (!error) return { ok: true }
  return { ok: false, errorCode: error.code, message: error.message }
}

const unavailable: AuthResult = { ok: false, errorCode: "unavailable" }

export async function signInWithPassword({ email, password }: Credentials): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable

  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return normalize(error)
}

export async function signUpWithPassword(
  input: SignUpInput,
  emailRedirectTo?: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailable

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
  if (!supabase) return unavailable

  const { error } = await supabase.auth.signOut()
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
