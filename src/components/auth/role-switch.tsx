"use client"

import type { UserRole } from "@/interfaces/auth"
import { cn } from "@/utils/cn"

import { Icon } from "@/components/ui/icon"
import { useTranslation } from "react-i18next"

interface RoleSwitchProps {
  value: UserRole
  onChange: (role: UserRole) => void
}

export function RoleSwitch({ value, onChange }: RoleSwitchProps) {
  const { t } = useTranslation()

  const options = [
    {
      role: "customer" as const,
      label: t("auth.roleSwitch.customer"),
      hint: t("auth.roleSwitch.customerHint"),
      icon: "search" as const,
    },
    {
      role: "professional" as const,
      label: t("auth.roleSwitch.professional"),
      hint: t("auth.roleSwitch.professionalHint"),
      icon: "badge-check" as const,
    },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={t("auth.roleSwitch.label")}
      className="border-cream/10 grid grid-cols-1 gap-1.5 rounded-2xl border bg-black/30 p-1.5 sm:grid-cols-2"
    >
      {options.map((option) => {
        const active = value === option.role
        return (
          <button
            key={option.role}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.role)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl px-3.5 py-3 text-left transition",
              active ? "bg-gold text-gold-ink" : "text-cream/70 hover:bg-cream/5 hover:text-cream",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Icon name={option.icon} className="size-4" />
              {option.label}
            </span>
            <span
              className={cn("text-xs leading-snug", active ? "text-gold-ink/75" : "text-cream/45")}
            >
              {option.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}
