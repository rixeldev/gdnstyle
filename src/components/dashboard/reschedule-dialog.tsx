"use client"

import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Modal } from "@/components/ui/modal"
import { toast } from "@/components/ui/toast"
import { DatePicker } from "@/components/venues/date-picker"
import type { Booking } from "@/hooks/use-bookings"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import {
  ChangeWindowClosedError,
  fetchOccupiedSlots,
  SlotUnavailableError,
  type OccupiedSlot,
} from "@/services/appointments.service"
import {
  buildDaySlots,
  fetchProviderSchedule,
  NO_SCHEDULE,
  type ProviderScheduleRow,
} from "@/services/availability.service"
import { addDays, parseDateKey } from "@/utils/date"
import { formatDate, formatTime, toIntlLocale } from "@/utils/format"
import { cn } from "@/utils/cn"

/** Same horizon the booking form offers, so both grids show the same days. */
const DAYS_AHEAD = 60

/** Stable empty lists so derived values keep the same reference. */
const NO_OCCUPIED: OccupiedSlot[] = []

/**
 * Occupancy + working hours for one `date|provider` pair, tagged with the key
 * it answers so a day that is still loading never borrows the previous day's
 * result (same shape the booking form uses).
 */
interface DayAvailability {
  key: string
  occupied: OccupiedSlot[]
  schedule: ProviderScheduleRow[]
}

export interface RescheduleDialogProps {
  /** Booking being moved. The dialog is mounted per booking, so its own state
   * starts fresh every time it opens. */
  booking: Booking
  /**
   * `useBookings().reschedule`, passed in instead of calling the hook here:
   * each hook instance owns its own list, so the dialog has to move the row in
   * the very list the dashboard is rendering.
   */
  reschedule: (id: string, date: string, time: string) => Promise<Booking | null>
  onClose: () => void
}

/**
 * Move one of the client's appointments to another day/time.
 *
 * The grid reuses `buildDaySlots`, so only hours the professional really has
 * free are offered: taken hours, hours covered by another appointment's
 * duration, out-of-hours, lunch and past hours are absent rather than
 * disabled. The authoritative re-check happens again in the service, which
 * throws when the hour filled up or the 1h30m window closed meanwhile.
 */
export function RescheduleDialog({ booking, reschedule, onClose }: RescheduleDialogProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const titleId = useId()
  const supabase = getSupabaseBrowserClient()

  const [dateKey, setDateKey] = useState<string>(booking.date)
  const [time, setTime] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Database bookings answer from the real tables; local demo records have no
  // rows behind them, so they keep the deterministic demo availability.
  const live = Boolean(booking.database && supabase)
  const [day, setDay] = useState<DayAvailability | null>(null)
  const availabilityKey = live && dateKey ? `${dateKey}|${booking.professionalId ?? ""}` : ""

  // Occupancy excludes the appointment being moved: its own current slot must
  // not block the day it is leaving, otherwise re-picking it would look taken.
  useEffect(() => {
    if (!availabilityKey || !supabase) return

    const separator = availabilityKey.indexOf("|")
    const date = availabilityKey.slice(0, separator)
    const provider = availabilityKey.slice(separator + 1)
    const locationId = booking.venueId
    const appointmentId = booking.id

    let active = true
    void Promise.all([
      fetchOccupiedSlots(supabase, {
        locationId,
        providerId: provider || null,
        date,
        excludeId: appointmentId,
      }),
      provider ? fetchProviderSchedule(supabase, provider) : Promise.resolve(NO_SCHEDULE),
    ])
      .then(([occupied, schedule]) => {
        if (!active) return
        setDay({ key: availabilityKey, occupied, schedule })
      })
      // A failed read must not block the move: the service re-validates anyway.
      .catch(() => {
        if (!active) return
        setDay({ key: availabilityKey, occupied: NO_OCCUPIED, schedule: NO_SCHEDULE })
      })

    return () => {
      active = false
    }
  }, [availabilityKey, supabase, booking.venueId, booking.id])

  // Derived straight from the loaded key: no extra render just to clear state.
  const loaded = day && day.key === availabilityKey ? day : null
  const occupied = loaded?.occupied ?? NO_OCCUPIED
  const schedule = loaded?.schedule ?? NO_SCHEDULE
  const checking = Boolean(availabilityKey && !loaded)

  const today = new Date()
  const lastBookableDay = addDays(today, DAYS_AHEAD - 1)
  const durationMinutes = booking.durationMinutes ?? 30
  const slots = dateKey
    ? buildDaySlots({
        dateKey,
        durationMinutes,
        occupied,
        schedule,
        demo: !live,
      })
    : []

  async function handleSave() {
    if (!dateKey || !time || saving) return
    setSaving(true)

    let saved: Booking | null
    try {
      saved = await reschedule(booking.id, dateKey, time)
    } catch (error) {
      setSaving(false)
      if (error instanceof ChangeWindowClosedError) {
        toast(t("dashboard.customer.changesLockedToast"), "neutral")
      } else if (error instanceof SlotUnavailableError) {
        toast(t("venues.booking.slotTaken"), "neutral")
      } else {
        toast(t("common.tryAgain"), "neutral")
      }
      return
    }

    if (!saved) {
      setSaving(false)
      toast(t("common.tryAgain"), "neutral")
      return
    }

    toast(
      t("dashboard.customer.editMoved", {
        date: formatDate(parseDateKey(saved.date), locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        time: formatTime(new Date(`${saved.date}T${saved.time}:00`), locale),
      }),
    )
    onClose()
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <div className="p-5">
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {t("dashboard.customer.editTitle")}
        </h2>
        <p className="text-cream/60 mt-2 text-sm leading-relaxed">
          {t("dashboard.customer.editBody")}
        </p>

        <fieldset className="mt-4">
          <legend className="text-cream/70 text-sm font-medium">
            {t("venues.booking.dayLabel")}
          </legend>
          <div className="mt-2">
            <DatePicker
              value={dateKey}
              onChange={(key) => {
                setDateKey(key)
                setTime(null)
              }}
              minDate={today}
              maxDate={lastBookableDay}
              locale={locale}
            />
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-cream/70 text-sm font-medium">
            {t("venues.booking.timeLabel")}
          </legend>
          {checking ? (
            <p className="text-cream/50 mt-3 inline-flex items-center gap-2 text-xs">
              <Icon name="clock" className="size-4" />
              {t("venues.booking.checkingAvailability")}
            </p>
          ) : slots.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={time === slot}
                  onClick={() => setTime(slot)}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-sm transition",
                    time === slot
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-cream/15 text-cream/75 hover:border-gold/50 hover:text-gold",
                  )}
                >
                  {formatTime(new Date(`${dateKey}T${slot}:00`), locale)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-cream/50 mt-3 text-xs">{t("venues.booking.noSlots")}</p>
          )}
        </fieldset>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!dateKey || !time || checking}
            iconLeft={<Icon name="calendar" className="size-4" />}
          >
            {t("dashboard.customer.editSave")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
