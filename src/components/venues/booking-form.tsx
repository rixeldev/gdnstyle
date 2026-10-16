"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import { Button, ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { DatePicker } from "@/components/venues/date-picker"
import { PaymentForm, type CloudBookingContext } from "@/components/venues/payment-form"
import { getVenueProfessionals } from "@/constants/professionals"
import { venueServiceOptions } from "@/libs/marketplace/venue-services"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import type { Venue } from "@/constants/venues"
import type { DbAppointment } from "@/interfaces/appointments"
import { type Booking, useBookings } from "@/hooks/use-bookings"
import { useBookingAccess, useSession } from "@/libs/session"
import { createId } from "@/libs/storage"
import {
  buildDaySlots,
  fetchProviderSchedule,
  NO_SCHEDULE,
  type ProviderScheduleRow,
} from "@/services/availability.service"
import {
  fetchOccupiedSlots,
  SlotUnavailableError,
  type OccupiedSlot,
} from "@/services/appointments.service"
import { cn } from "@/utils/cn"
import { addDays, parseDateKey } from "@/utils/date"
import { formatClockTime, formatCurrency, formatDate } from "@/utils/format"
import { bookingCharge } from "@/utils/payment-fees"

const DAYS_AHEAD = 60

/** Current epoch milliseconds, read from the event handler (kept out of render). */
function nowMs(): number {
  return Date.now()
}

/** Availability of one day for one provider, as loaded from the database. */
interface DayAvailability {
  /** `${dateKey}|${providerId}` this answer belongs to. */
  key: string
  occupied: OccupiedSlot[]
  schedule: ProviderScheduleRow[]
}

/** Stable empty occupancy list so effects keep the same reference. */
const NO_OCCUPIED: OccupiedSlot[] = []

/** Postgres `time` (`HH:MM:SS`) → the `HH:MM` used across the booking UI. */
function toHhMm(value: string): string {
  return value.slice(0, 5)
}

function longDate(dateKey: string, locale: string): string {
  return formatDate(parseDateKey(dateKey), locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

interface BookingFormProps {
  venue: Venue
  locale: string
}

/** Service → date/time → confirmation stepper (test-data booking). */
export function BookingForm({ venue, locale }: BookingFormProps) {
  const { t } = useTranslation()
  const { ready: accessReady, allowed } = useBookingAccess()
  const { user } = useSession()
  const { add } = useBookings()
  const databaseProfessionals = venue.professionals ?? []
  const professionals: { id: string; name: string }[] =
    databaseProfessionals.length > 0
      ? databaseProfessionals.map((professional) => ({
          id: professional.id,
          name: professional.name,
        }))
      : getVenueProfessionals(venue).map((professional) => ({
          id: professional.id,
          name: professional.name,
        }))
  const serviceOptions = venueServiceOptions(venue).map((option) => ({
    ...option,
    displayLabel: option.label ?? (option.labelKey ? t(option.labelKey) : ""),
  }))

  // Deep links (e.g. "Book again" from the dashboard history) may preselect a
  // service via `?service=`; unknown ids fall back to the plain stepper. The
  // param only seeds the initial state — the URL does not change while the
  // form is mounted.
  const requestedService = useSearchParams().get("service")
  const prefilledServiceId =
    requestedService && serviceOptions.some((option) => option.id === requestedService)
      ? requestedService
      : null

  const [step, setStep] = useState(prefilledServiceId ? 1 : 0)
  const [serviceId, setServiceId] = useState<string | null>(prefilledServiceId)
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [dateKey, setDateKey] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<{ id: string; date: string; time: string } | null>(
    null,
  )

  const supabase = getSupabaseBrowserClient()
  const selectedService = serviceOptions.find((option) => option.id === serviceId) ?? null
  // The booking always lands on one provider: the picked professional, else the
  // one offering the selected service, else the first professional of the venue.
  const providerId =
    professionalId ?? selectedService?.professionalId ?? professionals[0]?.id ?? null
  const serviceDuration = selectedService?.durationMin ?? 0
  // Live catalog venues have real appointments/schedules to check against; demo
  // venues keep the deterministic test availability (no tables behind them).
  const live = venue.source === "database" && Boolean(supabase)
  // Availability is stored tagged with the day/provider it belongs to, so a
  // day that is still loading never borrows the previous day's answer.
  const [daySlots, setDaySlots] = useState<DayAvailability | null>(null)
  const availabilityKey = live && dateKey && providerId ? `${dateKey}|${providerId}` : ""

  // Real availability for the chosen day: the provider's booked hours (each one
  // occupying its service duration) plus their working hours. Both are needed
  // to decide which start times the client may pick.
  useEffect(() => {
    if (!availabilityKey || !supabase) return

    const [date, provider] = availabilityKey.split("|")
    let active = true
    void Promise.all([
      fetchOccupiedSlots(supabase, {
        providerId: provider,
        date,
      }),
      fetchProviderSchedule(supabase, provider),
    ])
      .then(([occupiedRows, scheduleRows]) => {
        if (!active) return
        setDaySlots({ key: availabilityKey, occupied: occupiedRows, schedule: scheduleRows })
      })
      // A failed read must not block booking: creation re-validates anyway.
      .catch(() => {
        if (!active) return
        setDaySlots({
          key: availabilityKey,
          occupied: NO_OCCUPIED,
          schedule: NO_SCHEDULE,
        })
      })

    return () => {
      active = false
    }
  }, [availabilityKey, supabase])

  // Derived straight from the loaded key: no extra render just to clear state.
  const loaded = daySlots && daySlots.key === availabilityKey ? daySlots : null
  const occupied = loaded?.occupied ?? NO_OCCUPIED
  const schedule = loaded?.schedule ?? NO_SCHEDULE
  const checkingSlots = Boolean(availabilityKey && !loaded)

  if (!accessReady) {
    return <Button size="lg" loading disabled className="mt-5 w-full" />
  }

  if (!allowed) {
    return (
      <>
        <p className="text-cream/45 mt-5 text-xs">{t("venues.detail.signInHint")}</p>
        <ButtonLink
          href={`/auth/login?next=${encodeURIComponent(`/venues/${venue.id}`)}`}
          size="lg"
          className="mt-3 w-full"
        >
          {t("nav.signIn")}
        </ButtonLink>
      </>
    )
  }

  // Professionals manage venues; they do not book appointments.
  if (user?.role === "professional") {
    return (
      <div className="border-gold/25 bg-gold/5 mt-5 rounded-2xl border p-5 text-center">
        <Icon name="badge-check" className="text-gold mx-auto size-6" />
        <p className="text-cream/85 mt-3 text-sm font-medium">{t("venues.booking.proOnlyTitle")}</p>
        <p className="text-cream/55 mt-1.5 text-xs leading-relaxed">
          {t("venues.booking.proOnlyBody")}
        </p>
        <ButtonLink href="/dashboard" variant="outline" size="sm" className="mt-4">
          {t("venues.booking.proOnlyCta")}
        </ButtonLink>
      </div>
    )
  }

  // Built after the session gate so no clock reads happen during prerender.
  const today = new Date()
  const lastBookableDay = addDays(today, DAYS_AHEAD - 1)
  // Start times the client may actually pick: inside the professional's
  // working window, outside lunch, not colliding with another appointment's
  // duration and not in the past. Anything else is simply not offered.
  const slots = dateKey
    ? buildDaySlots({
        dateKey,
        durationMinutes: serviceDuration,
        occupied,
        schedule,
        demo: !live,
      })
    : []

  function reset() {
    setStep(0)
    setServiceId(null)
    setProfessionalId(null)
    setDateKey(null)
    setTime(null)
    setConfirmed(null)
  }

  async function handlePaid() {
    if (!serviceId || !dateKey || !time) return
    const service = serviceOptions.find((option) => option.id === serviceId)
    const booking: Booking = {
      id: createId(venue.id),
      venueId: venue.id,
      serviceId,
      professionalId: providerId,
      date: dateKey,
      time,
      price: service?.price ?? venue.priceFrom,
      createdAt: nowMs(),
      serviceName: service?.displayLabel,
      professionalName: professionals.find((item) => item.id === providerId)?.name,
      durationMinutes: service?.durationMin,
      clientName: user?.fullName ?? undefined,
      clientEmail: user?.email ?? undefined,
      clientPhone: user?.phone ?? undefined,
      database: venue.source === "database",
    }

    try {
      // Persists to `appointments` when Supabase is configured, otherwise keeps
      // the local test record.
      const saved = await add(booking)
      setConfirmed({ id: saved.id, date: saved.date, time: saved.time })
      toast(
        t("venues.booking.toast", {
          date: longDate(dateKey, locale),
          time: formatClockTime(time, locale),
        }),
      )
    } catch (error) {
      // The slot filled up between picking it and creating the row: send the
      // visitor back to the grid with the refreshed availability.
      if (error instanceof SlotUnavailableError) {
        toast(t("venues.booking.slotTaken"), "neutral")
        setTime(null)
        setStep(1)
        return
      }
      toast(t("errors.generic"), "neutral")
    }
  }

  /** Cloud path: the `create-appointment` function already created the row. */
  async function handleCloudPaid(appointment: DbAppointment) {
    setConfirmed({
      id: appointment.id,
      date: appointment.scheduled_date,
      time: toHhMm(appointment.scheduled_time),
    })
    toast(
      t("venues.booking.toast", {
        date: longDate(dateKey ?? appointment.scheduled_date, locale),
        time: time ? formatClockTime(time, locale) : appointment.scheduled_time.slice(0, 5),
      }),
    )
  }

  if (confirmed) {
    return (
      <div role="status" className="mt-6 text-center">
        <Icon name="check-circle" className="text-gold mx-auto size-11" />
        <p className="font-display mt-3 text-xl font-semibold">
          {t("venues.booking.successTitle")}
        </p>
        <p className="text-cream/65 mt-2 text-sm leading-relaxed">
          {t("venues.booking.successBody", {
            date: longDate(confirmed.date, locale),
            time: formatClockTime(confirmed.time, locale),
          })}
        </p>
        <p className="text-cream/40 mt-4 text-[11px] tracking-[0.2em] uppercase">
          {t("venues.booking.successCode")}
        </p>
        <p className="font-display text-gold text-lg">{confirmed.id.slice(-6).toUpperCase()}</p>
        <div className="mt-5 flex flex-col gap-2">
          <ButtonLink href="/dashboard" size="sm">
            {t("venues.booking.viewBookings")}
          </ButtonLink>
          <Button variant="outline" size="sm" onClick={reset}>
            {t("venues.booking.bookAnother")}
          </Button>
        </div>
      </div>
    )
  }

  const serviceLabel = selectedService?.displayLabel ?? ""
  const professionalLabel =
    professionalId === null
      ? t("venues.professionals.anyone")
      : (professionals.find((item) => item.id === professionalId)?.name ??
        t("venues.professionals.anyone"))
  const price = selectedService ? selectedService.price : venue.priceFrom
  // Refuse to advance while the availability of the chosen day is still being
  // read, so a slot never slips through before its check finished.
  const canContinue = step === 0 ? Boolean(serviceId) : Boolean(dateKey && time && !checkingSlots)

  // Real bookings (live catalog venues) run through the payment Edge
  // Functions; demo venues keep the local gateway.
  const cloudBooking: CloudBookingContext | null =
    venue.source === "database" && serviceId && dateKey && time && providerId
      ? {
          providerId,
          serviceId,
          serviceName: serviceLabel || null,
          locationId: venue.id,
          date: dateKey,
          time,
          durationMinutes: serviceDuration || undefined,
          clientName: user?.fullName ?? null,
          clientEmail: user?.email ?? null,
          clientPhone: user?.phone ? Number(user.phone.replace(/\D/g, "")) : null,
        }
      : null

  // What a live booking actually charges: the price grossed up for the platform
  // cut and Stripe's processing — the same math the payment function runs, so
  // the number shown here is the number the card is asked for.
  const charge = cloudBooking ? bookingCharge(price) : null

  return (
    <div className="mt-5">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {[
          t("venues.booking.stepService"),
          t("venues.booking.stepWhen"),
          t("venues.booking.stepPayment"),
        ].map((label, index) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-1.5",
              index <= step ? "text-gold" : "text-cream/35",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px]",
                index <= step ? "border-gold bg-gold/15" : "border-cream/20",
              )}
            >
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <fieldset className="mt-5">
          <legend className="text-cream/70 text-sm font-medium">
            {t("venues.booking.serviceLabel")}
          </legend>
          <div className="mt-3 space-y-2">
            {serviceOptions.map((option) => {
              const active = serviceId === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setServiceId(option.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition",
                    active
                      ? "border-gold/60 bg-gold/10"
                      : "border-cream/10 bg-cream/3 hover:border-gold/30",
                  )}
                >
                  <span>
                    <span className="block font-medium">{option.displayLabel}</span>
                    <span className="text-cream/45 text-xs">
                      {t("venues.booking.duration", { count: option.durationMin })}
                    </span>
                  </span>
                  <span className="text-cream shrink-0 font-semibold">
                    {formatCurrency(option.price, locale, "USD", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <div className="mt-5 space-y-5">
          <fieldset>
            <legend className="text-cream/70 text-sm font-medium">
              {t("venues.booking.professionalLabel")}
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={professionalId === null}
                onClick={() => setProfessionalId(null)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  professionalId === null
                    ? "border-gold/60 bg-gold/15 text-gold"
                    : "border-cream/10 text-cream/65 hover:border-gold/40",
                )}
              >
                {t("venues.professionals.anyone")}
              </button>
              {professionals.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setProfessionalId(item.id)}
                  aria-pressed={professionalId === item.id}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    professionalId === item.id
                      ? "border-gold/60 bg-gold/15 text-gold"
                      : "border-cream/10 bg-cream/3 text-cream/70 hover:border-gold/40",
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-cream/70 text-sm font-medium">
              {t("venues.booking.dayLabel")}
            </legend>
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
          </fieldset>

          {dateKey && (
            <fieldset>
              <legend className="text-cream/70 text-sm font-medium">
                {t("venues.booking.timeLabel")}
              </legend>
              {checkingSlots ? (
                <p className="text-cream/50 mt-3 inline-flex items-center gap-2 text-xs">
                  <Icon name="clock" className="size-4" />
                  {t("venues.booking.checkingAvailability")}
                </p>
              ) : slots.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {slots.map((slot) => {
                    const active = time === slot
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setTime(slot)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-xs font-medium transition",
                          active
                            ? "border-gold/60 bg-gold/15 text-gold"
                            : "border-cream/10 bg-cream/3 text-cream/70 hover:border-gold/40",
                        )}
                      >
                        {formatClockTime(slot, locale)}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-cream/50 mt-3 text-xs">{t("venues.booking.noSlots")}</p>
              )}
            </fieldset>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="mt-5">
          <p className="text-cream/70 text-sm font-medium">{t("venues.booking.confirmLabel")}</p>
          <dl className="border-cream/10 bg-cream/3 mt-3 space-y-2.5 rounded-2xl border p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-cream/50">{t("venues.booking.summaryService")}</dt>
              <dd className="text-right">
                {serviceLabel}
                {serviceDuration > 0 &&
                  ` · ${t("venues.booking.duration", { count: serviceDuration })}`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cream/50">{t("venues.booking.summaryWhen")}</dt>
              <dd className="text-right">
                {dateKey ? longDate(dateKey, locale) : ""}
                {time ? ` · ${formatClockTime(time, locale)}` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cream/50">{t("venues.booking.summaryProfessional")}</dt>
              <dd className="text-right">{professionalLabel}</dd>
            </div>
            <div className="border-cream/10 border-t pt-2.5">
              <div className="flex justify-between gap-3">
                <dt className="text-cream/70">{t("venues.booking.summaryPrice")}</dt>
                <dd className="font-semibold">{formatCurrency(price, locale, "USD")}</dd>
              </div>
              {/* A live booking is charged the grossed-up total — service plus
                  the platform cut and Stripe's processing — so the summary has
                  to say so before the card does. Demo venues charge the price
                  as it stands and keep the single line. */}
              {charge && (
                <>
                  <div className="text-cream/50 mt-1 flex justify-between gap-3">
                    <dt>{t("venues.booking.processingFee")}</dt>
                    <dd>{formatCurrency(charge.feeCents / 100, locale, "USD")}</dd>
                  </div>
                  <div className="border-cream/10 mt-2 flex justify-between gap-3 border-t pt-2">
                    <dt className="text-cream/70 font-medium">
                      {t("venues.booking.summaryTotal")}
                    </dt>
                    <dd className="text-gold font-semibold">
                      {formatCurrency(charge.totalCents / 100, locale, "USD")}
                    </dd>
                  </div>
                </>
              )}
            </div>
          </dl>
          <p className="text-cream/45 mt-3 text-xs leading-relaxed">
            {t("venues.booking.summaryNote")}
          </p>

          {/* Step through the payment gateway before the booking is created. */}
          <PaymentForm
            amount={price}
            amountLabel={formatCurrency(price, locale, "USD", { maximumFractionDigits: 0 })}
            locale={locale}
            booking={cloudBooking ?? undefined}
            onPaid={handlePaid}
            onCloudPaid={handleCloudPaid}
          />
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        {step > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((value) => value - 1)}
            iconLeft={<Icon name="arrow-left" className="size-4" />}
          >
            {t("venues.booking.back")}
          </Button>
        )}
        <span className="flex-1" />
        {step < 2 ? (
          <Button size="sm" disabled={!canContinue} onClick={() => setStep((value) => value + 1)}>
            {t("venues.booking.next")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
