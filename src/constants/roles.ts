import type { UserRole } from "@/interfaces/auth"

/**
 * Fallback permissions mirroring the `roles` seed in migration 0002. The
 * database (`roles.permissions`) is the source of truth; this table keeps the
 * demo backend and first renders coherent before that query resolves. The
 * `admin` role lives only in the database until the app grows admin screens.
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  customer: [
    "book_appointment",
    "cancel_appointment",
    "rebook_appointment",
    "manage_favorites",
    "write_review",
    "manage_payment_methods",
    "edit_profile",
  ],
  professional: [
    "manage_venues",
    "manage_services",
    "manage_schedule",
    "view_appointments",
    "update_appointment_status",
    "edit_profile",
  ],
}
