import type { Metadata } from "next"
import { Suspense } from "react"

import { DashboardPanel } from "@/components/dashboard/dashboard-panel"

export const metadata: Metadata = {
  title: "Your dashboard",
  description: "Your GDN Style dashboard: appointments, favorites, services and more.",
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPanel />
    </Suspense>
  )
}
