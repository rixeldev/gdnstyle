"use client"

import { useTranslation } from "react-i18next"

import type { AppointmentDisplayStatus } from "@/utils/appointment-status"

/** The same three active states everywhere, plus the terminal cancelled. */
const STYLES: Record<AppointmentDisplayStatus, string> = {
  // Waiting for the professional to vouch for it.
  pending: "border-gold/30 bg-gold/10 text-gold",
  confirmed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  // The hour went by without a confirmation: something needs attention.
  overdue: "border-red-400/30 bg-red-400/10 text-red-300",
  cancelled: "border-cream/20 bg-cream/5 text-cream/55",
}

interface AppointmentStatusBadgeProps {
  status: AppointmentDisplayStatus
  className?: string
}

/**
 * Pill naming the state of an appointment for the reader in front of it: the
 * client sees it as information, the professional reads the same pill as the
 * thing they can act on (confirm a pending or overdue booking).
 */
export function AppointmentStatusBadge({ status, className }: AppointmentStatusBadgeProps) {
  const { t } = useTranslation()

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${STYLES[status]} ${className ?? ""}`}
    >
      {t(`dashboard.appointmentStatus.${status}`)}
    </span>
  )
}
