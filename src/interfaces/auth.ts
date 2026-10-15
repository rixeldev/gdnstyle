export type UserRole = "customer" | "professional"

export interface Profile {
  id: string
  role: UserRole
  fullName: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

/** Normalized result returned by the auth service so the UI can localize errors. */
export interface AuthResult {
  ok: boolean
  errorCode?: string
  message?: string
}

export interface Credentials {
  email: string
  password: string
}

export interface SignUpInput extends Credentials {
  fullName: string
  role: UserRole
  /** Contact phone; required for professionals, optional for customers. */
  phone?: string
  /** Professional onboarding extras (stored on the `providers` row). */
  city?: string
  instagram?: string
  tiktok?: string
}
