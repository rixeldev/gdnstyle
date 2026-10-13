"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, ButtonLink } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { DatePicker } from "@/components/venues/date-picker"
import { PaymentForm } from "@/components/venues/payment-form"
import { getVenueProfessionals } from "@/constants/professionals"
import { venueServiceOptions } from "@/libs/marketplace/venue-services"
import type { Venue } from "@/constants/venues"
import { type Booking, useBookings } from "@/hooks/use-bookings"
import { useBookingAccess, useSession } from "@/libs/session"
import { createId } from "@/libs/storage"
import { cn } from "@/utils/cn"
import { addDays, dayNumber, parseDateKey, timeslotEpoch } from "@/utils/date"
import { formatCurrency, formatDate, formatTime } from "@/utils/format"

const DAYS_AHEAD = 60
const SLOT_START_MIN = 9 * 60
const SLOT_END_MIN = 18 * 60 + 15
const SLOT_STEP_MIN = 45

/** Current epoch milliseconds, read from the event handler (kept out of render). */
function nowMs(): number {
  return Date.now()
}

interface Slot {
  time: string
  available: boolean
}

/** Deterministic test availability (roughly 20% of slots are taken). */
function buildSlots(dateKey: string): Slot[] {
  const seed = dayNumber(parseDateKey(dateKey))
  const now = Date.now()
  const slots: Slot[] = []

  for (
    let minutes = SLOT_START_MIN, index = 0;
    minutes <= SLOT_END_MIN;
    minutes += SLOT_STEP_MIN, index += 1
  ) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0")
    const mins = String(minutes % 60).padStart(2, "0")
    const time = `${hours}:${mins}`
    slots.push({
      time,
      available: (seed + index * 7) % 5 !== 0 && timeslotEpoch(dateKey, time) > now,
    })
  }

  return slots
}

function timeLabel(time: string, locale: string): string {
  const [hours, minutes] = time.split(":").map(Number)
  return formatTime(new Date(2000, 0, 1, hours, minutes), locale)
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

  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [dateKey, setDateKey] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<{ id: string; date: string; time: string } | null>(
    null,
  )

  if (!accessReady) {
    return <Button size="lg" loading disabled className="mt-5 w-full" />
  }

  if (!allowed) {
    return (
      <>
        <p className="text-cream/45 mt-5 text-xs">{t("venues.detail.signInHint")}</p>
        <ButtonLink
          href={`/auth/login?next=${encodeURIComponent(`/locales/${venue.id}`)}`}
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
  const slots = dateKey ? buildSlots(dateKey) : []
  const availableSlots = slots.filter((slot) => slot.available)

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
    // The database requires a provider: fall back to the one offering the
    // selected service, then to the first professional of the venue.
    const providerId = professionalId ?? service?.professionalId ?? professionals[0]?.id ?? null
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
          time: timeLabel(time, locale),
        }),
      )
    } catch {
      toast(t("errors.generic"), "neutral")
    }
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
            time: timeLabel(confirmed.time, locale),
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

  const selectedService = serviceOptions.find((option) => option.id === serviceId) ?? null
  const serviceLabel = selectedService?.displayLabel ?? ""
  const professionalLabel =
    professionalId === null
      ? t("venues.professionals.anyone")
      : (professionals.find((item) => item.id === professionalId)?.name ??
        t("venues.professionals.anyone"))
  const price = selectedService ? selectedService.price : venue.priceFrom
  const serviceDuration = selectedService?.durationMin ?? 0
  const canContinue = step === 0 ? Boolean(serviceId) : Boolean(dateKey && time)

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
                    {formatCurrency(option.price, locale, "DOP", {
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
              {availableSlots.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => {
                    const active = time === slot.time
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setTime(slot.time)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-xs font-medium transition",
                          active
                            ? "border-gold/60 bg-gold/15 text-gold"
                            : "border-cream/10 bg-cream/3 text-cream/70 hover:border-gold/40",
                        )}
                      >
                        {timeLabel(slot.time, locale)}
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
                {time ? ` · ${timeLabel(time, locale)}` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cream/50">{t("venues.booking.summaryProfessional")}</dt>
              <dd className="text-right">{professionalLabel}</dd>
            </div>
            <div className="border-cream/10 flex justify-between gap-3 border-t pt-2.5">
              <dt className="text-cream/70">{t("venues.booking.summaryPrice")}</dt>
              <dd className="text-gold font-semibold">
                {formatCurrency(price, locale, "DOP", { maximumFractionDigits: 0 })}
              </dd>
            </div>
          </dl>
          <p className="text-cream/45 mt-3 text-xs leading-relaxed">
            {t("venues.booking.summaryNote")}
          </p>

          {/* Step through the payment gateway before the booking is created. */}
          <PaymentForm
            amount={price}
            amountLabel={formatCurrency(price, locale, "DOP", { maximumFractionDigits: 0 })}
            onPaid={handlePaid}
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
