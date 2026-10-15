"use client"

import { useCallback, useEffect, useState } from "react"

import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  fetchProviderSchedule,
  fillWeek,
  saveProviderSchedule,
  type ProviderScheduleRow,
} from "@/services/provider-schedule.service"

/**
 * The signed-in professional's working hours, one entry per weekday.
 *
 * Reads are open to everyone (RLS "Clients can view provider schedules"), and
 * writes only succeed for the owner of the row, so a professional without a
 * `providers` row simply gets the default week and a failed save.
 */
export function useProviderSchedule() {
  const supabase = getSupabaseBrowserClient()
  const { user } = useSession()
  const providerId = user?.providerId ?? null
  const [rows, setRows] = useState<ProviderScheduleRow[] | null>(null)

  useEffect(() => {
    if (!supabase || !providerId) return

    let active = true
    void fetchProviderSchedule(supabase, providerId).then((value) => {
      if (!active) return
      setRows(fillWeek(value))
    })

    return () => {
      active = false
    }
  }, [supabase, providerId])

  const save = useCallback(
    async (next: ProviderScheduleRow[]): Promise<boolean> => {
      if (!supabase || !providerId) return false
      const ok = await saveProviderSchedule(supabase, providerId, next)
      // Only the saved version becomes the new baseline, so "unsaved changes"
      // stays true when the write is refused.
      if (ok) setRows(next)
      return ok
    },
    [supabase, providerId],
  )

  return { rows: rows ?? [], ready: rows !== null, providerId, save }
}
