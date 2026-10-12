"use client"

import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Icon } from "@/components/ui/icon"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/utils/cn"
import {
  addDays,
  addMonths,
  buildMonthGrid,
  parseDateKey,
  startOfMonth,
  toDateKey,
} from "@/utils/date"
import { formatDate } from "@/utils/format"

interface DatePickerProps {
  /** Selected day as `YYYY-MM-DD`, or `null` when nothing is picked yet. */
  value: string | null
  onChange: (dateKey: string) => void
  /** First bookable day (always today). */
  minDate: Date
  /** Last bookable day. */
  maxDate: Date
  locale: string
}

// A known Monday, used to derive locale-aware weekday column labels.
const WEEK_REFERENCE = new Date(2024, 0, 1)

/** Day field that opens a month calendar in a modal. */
export function DatePicker({ value, onChange, minDate, maxDate, locale }: DatePickerProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<Date>(() =>
    startOfMonth(value ? parseDateKey(value) : minDate),
  )

  const minKey = toDateKey(minDate)
  const maxKey = toDateKey(maxDate)
  const todayKey = toDateKey(minDate)
  const tomorrowKey = toDateKey(addDays(minDate, 1))

  const weekdays = Array.from({ length: 7 }, (_, index) =>
    formatDate(addDays(WEEK_REFERENCE, index), locale, { weekday: "short" }),
  )
  const cells = buildMonthGrid(month)

  const canGoPrev = month > startOfMonth(minDate)
  const canGoNext = month < startOfMonth(maxDate)

  function openPicker() {
    setMonth(startOfMonth(value ? parseDateKey(value) : minDate))
    setOpen(true)
  }

  function select(dateKey: string) {
    onChange(dateKey)
    setOpen(false)
  }

  function chip(dateKey: string, label: string) {
    return (
      <button
        type="button"
        onClick={() => select(dateKey)}
        aria-pressed={value === dateKey}
        className={cn(
          "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
          value === dateKey
            ? "border-gold/60 bg-gold/15 text-gold"
            : "border-cream/12 text-cream/70 hover:border-gold/40",
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="border-cream/10 bg-cream/3 hover:border-gold/40 mt-3 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition"
      >
        <Icon name="calendar" className="text-gold size-4 shrink-0" />
        <span className={cn("min-w-0 flex-1 truncate text-left", value ? "" : "text-cream/50")}>
          {value
            ? formatDate(parseDateKey(value), locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : t("venues.booking.pickDay")}
        </span>
        <span className="text-cream/45 shrink-0 text-xs">
          {value ? t("venues.booking.changeDay") : ""}
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <p id={titleId} className="font-display text-lg font-semibold">
              {t("venues.booking.dayLabel")}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="text-cream/55 hover:bg-cream/8 hover:text-cream flex size-8 items-center justify-center rounded-full transition"
            >
              <Icon name="close" className="size-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {chip(todayKey, t("venues.booking.today"))}
            {chip(tomorrowKey, t("venues.booking.tomorrow"))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((current) => addMonths(current, -1))}
              disabled={!canGoPrev}
              aria-label={t("venues.booking.prevMonth")}
              className="text-cream/70 hover:bg-cream/8 hover:text-cream flex size-9 items-center justify-center rounded-full transition disabled:pointer-events-none disabled:opacity-30"
            >
              <Icon name="arrow-left" className="size-4" />
            </button>
            <p className="text-sm font-semibold capitalize">
              {formatDate(month, locale, { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              disabled={!canGoNext}
              aria-label={t("venues.booking.nextMonth")}
              className="text-cream/70 hover:bg-cream/8 hover:text-cream flex size-9 items-center justify-center rounded-full transition disabled:pointer-events-none disabled:opacity-30"
            >
              <Icon name="arrow-right" className="size-4" />
            </button>
          </div>

          <div className="text-cream/40 mt-3 grid grid-cols-7 gap-1 text-center text-[11px] tracking-wide uppercase">
            {weekdays.map((weekday) => (
              <span key={weekday} className="py-1">
                {weekday}
              </span>
            ))}
          </div>

          <div className="mt-1 grid auto-rows-9 grid-cols-7 gap-1">
            {cells.map((date, index) => {
              if (!date) return <span key={`blank-${index}`} aria-hidden="true" />
              const dateKey = toDateKey(date)
              const disabled = dateKey < minKey || dateKey > maxKey
              const selected = dateKey === value
              const isToday = dateKey === todayKey
              return (
                <button
                  key={dateKey}
                  type="button"
                  disabled={disabled}
                  onClick={() => select(dateKey)}
                  aria-pressed={selected}
                  aria-label={
                    disabled
                      ? `${formatDate(date, locale, { day: "numeric", month: "long" })}, ${t("venues.booking.dayUnavailable")}`
                      : formatDate(date, locale, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })
                  }
                  className={cn(
                    "flex h-9 items-center justify-center rounded-xl text-sm transition",
                    selected
                      ? "bg-gold text-gold-ink font-semibold"
                      : disabled
                        ? "text-cream/20"
                        : isToday
                          ? "border-gold/40 text-gold hover:bg-gold/10 border"
                          : "text-cream/80 hover:bg-cream/8",
                  )}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <p className="text-cream/40 mt-4 text-xs">
            {t("venues.booking.windowHint", {
              date: formatDate(maxDate, locale, { day: "numeric", month: "long" }),
            })}
          </p>
        </div>
      </Modal>
    </>
  )
}
