"use client"

import { useTranslation } from "react-i18next"

/**
 * Card-shaped loading placeholder used while the auth form resolves the
 * query string (role) inside a Suspense boundary.
 */
export function AuthCardSkeleton() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="visually-hidden">{t("common.loading")}</span>
      <div className="space-y-3">
        <div className="bg-cream/10 h-7 w-40 animate-pulse rounded-full" />
        <div className="bg-cream/7 h-4 w-64 animate-pulse rounded-full" />
      </div>
      <div className="bg-cream/5 h-20 animate-pulse rounded-2xl" />
      <div className="space-y-4">
        {[0, 1, 2].map((row) => (
          <div key={row} className="bg-cream/5 h-11 animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="bg-cream/7 h-11 animate-pulse rounded-full" />
    </div>
  )
}
