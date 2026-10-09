import type { Metadata } from "next"
import { Suspense } from "react"

import { DashboardPanel } from "@/components/dashboard/dashboard-panel"

export const metadata: Metadata = {
  title: "Tu panel",
  description: "Tu panel en GDN Style: citas, favoritos, servicios y más.",
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPanel />
    </Suspense>
  )
}
