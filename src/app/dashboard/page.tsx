import type { Metadata } from "next"
import { Suspense } from "react"

import { DashboardPanel } from "@/components/dashboard/dashboard-panel"

export const metadata: Metadata = {
  title: "Your dashboard",
  description:
    "Your GDN Style dashboard: appointments, favorites and payments for clients; agenda, venues, portfolio and earnings for professionals.",
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPanel />
    </Suspense>
  )
}
