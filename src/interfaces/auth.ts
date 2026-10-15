export type UserRole = "customer" | "professional"

/**
 * Postal address attached to an account. Customers keep theirs on `profiles`;
 * professionals publish theirs on `providers`, which is the row their public
 * card renders.
 */
export interface AccountAddress {
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
}

export const EMPTY_ADDRESS: AccountAddress = {
  line1: null,
  line2: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
}

/** Public contact links a professional shows on their card. */
export interface AccountSocials {
  instagram: string | null
  tiktok: string | null
  whatsapp: string | null
}

export const EMPTY_SOCIALS: AccountSocials = { instagram: null, tiktok: null, whatsapp: null }

export interface Profile {
  id: string
  role: UserRole
  fullName: string | null
  email: string | null
  phone: string | null
  bio: string | null
  address: AccountAddress
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
