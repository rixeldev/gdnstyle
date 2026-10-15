"use client"

import type { Session } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

import { ROLE_PERMISSIONS } from "@/constants/roles"
import {
  EMPTY_ADDRESS,
  EMPTY_SOCIALS,
  type AccountAddress,
  type AccountSocials,
  type UserRole,
} from "@/interfaces/auth"
import type { DbProvider } from "@/interfaces/marketplace"
import { demoProfile, readDemoSession } from "@/libs/auth/demo"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { STORAGE_EVENT } from "@/libs/storage"
import { fetchProfile, fetchRolePermissions } from "@/services/auth.service"
import { fetchProviderForUser } from "@/services/provider.service"

/** Normalized signed-in visitor, regardless of the auth backend in use. */
export interface SessionUser {
  id: string
  email: string | null
  fullName: string | null
  role: UserRole
  /** `providers.id` when `auth.uid()` owns a providers row, else `null`. */
  providerId: string | null
  avatarUrl: string | null
  phone: string | null
  bio: string | null
  /** Where the account is: `profiles` for customers, `providers` for professionals. */
  address: AccountAddress
  /** Professionals publish a business name; customers have none. */
  businessName: string | null
  /** Public contact links a professional shows (empty for customers). */
  socials: AccountSocials
  /** Permission keys granted by the DB `roles` row (static map as fallback). */
  permissions: string[]
  /** True when the session comes from the built-in demo layer. */
  demo: boolean
}

/** The address a `providers` row carries, which the public card renders. */
function providerAddress(provider: DbProvider): AccountAddress {
  return {
    line1: provider.address_line1 ?? null,
    line2: provider.address_line2 ?? null,
    city: provider.address_city ?? null,
    state: provider.address_state ?? null,
    postalCode: provider.address_postal_code ?? null,
    country: provider.address_country ?? null,
  }
}

export interface SessionState {
  ready: boolean
  user: SessionUser | null
  authenticated: boolean
}

function userFromDemo(): SessionUser | null {
  const session = readDemoSession()
  if (!session) return null

  // Edits live in their own store so they survive a session refresh; the
  // session itself only mirrors what was there when it was written.
  const patch = demoProfile(session.id)

  return {
    id: session.id,
    email: session.email,
    fullName: session.fullName,
    role: session.role,
    providerId: null,
    avatarUrl: session.avatarUrl,
    phone: session.phone ?? null,
    bio: session.bio ?? null,
    address: patch.address ?? EMPTY_ADDRESS,
    businessName: patch.businessName ?? null,
    socials: patch.socials ?? EMPTY_SOCIALS,
    permissions: ROLE_PERMISSIONS[session.role],
    demo: true,
  }
}

/**
 * True when a signed-in session exists. Works with either backend so gated
 * actions never run without an account.
 */
export async function hasSession(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return Boolean(readDemoSession())

  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

/**
 * Single source of truth for the signed-in visitor. Subscribes to Supabase auth
 * when configured, and to the localStorage demo session otherwise, so booking,
 * favorites, reviews and the dashboard all gate consistently.
 */
export function useSession(): SessionState {
  const supabase = getSupabaseBrowserClient()
  const [state, setState] = useState<Omit<SessionState, "authenticated">>({
    ready: false,
    user: null,
  })

  useEffect(() => {
    if (!supabase) {
      const sync = () => setState({ ready: true, user: userFromDemo() })
      sync()
      window.addEventListener(STORAGE_EVENT, sync)
      window.addEventListener("storage", sync)
      return () => {
        window.removeEventListener(STORAGE_EVENT, sync)
        window.removeEventListener("storage", sync)
      }
    }

    let active = true
    const client = supabase

    async function apply(session: Session | null) {
      if (!session?.user) {
        if (active) setState({ ready: true, user: null })
        return
      }

      // The database owns the role (`profiles.role` → `roles` catalog);
      // the providers row only backstops accounts that predate migration
      // 0002 and have no profile role yet.
      const profile = await fetchProfile(session.user.id)
      const [provider, dbPermissions] = await Promise.all([
        fetchProviderForUser(client, session.user.id),
        profile ? fetchRolePermissions(profile.role) : Promise.resolve([]),
      ])
      if (!active) return

      const role: UserRole = profile?.role ?? (provider ? "professional" : "customer")

      // A professional's address lives on the `providers` row because that is
      // the one the marketplace renders; a customer's on `profiles`.
      const address =
        role === "professional" && provider
          ? providerAddress(provider)
          : (profile?.address ?? EMPTY_ADDRESS)

      setState({
        ready: true,
        user: {
          id: session.user.id,
          email: session.user.email ?? profile?.email ?? null,
          fullName:
            profile?.fullName ??
            ((session.user.user_metadata?.full_name as string | undefined) || null),
          role,
          providerId: provider?.id ?? null,
          avatarUrl: profile?.avatarUrl ?? null,
          phone: profile?.phone ?? null,
          bio: profile?.bio ?? null,
          address,
          businessName: provider?.business_name ?? null,
          socials: {
            instagram: provider?.social_instagram ?? null,
            tiktok: provider?.social_tiktok ?? null,
            whatsapp: provider?.social_whatsapp ?? null,
          },
          permissions: dbPermissions.length > 0 ? dbPermissions : ROLE_PERMISSIONS[role],
          demo: false,
        },
      })
    }

    void supabase.auth.getSession().then(({ data }) => void apply(data.session))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void apply(session)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  return { ...state, authenticated: Boolean(state.user) }
}

/**
 * Booking/review gate. Kept as a thin wrapper so the flows keep their existing
 * `{ ready, allowed }` shape while sharing the unified session.
 */
export function useBookingAccess() {
  const { ready, authenticated } = useSession()
  return { ready, allowed: authenticated }
}
