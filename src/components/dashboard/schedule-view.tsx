"use client"

import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { ViewHeading } from "@/components/dashboard/view-primitives"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Spinner } from "@/components/ui/spinner"
import { fieldInputClasses } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { useProviderSchedule } from "@/hooks/use-provider-schedule"
import {
  dayMinutes,
  validateDay,
  validateSchedule,
  weekMinutes,
  type ProviderScheduleRow,
} from "@/services/provider-schedule.service"
import { cn } from "@/utils/cn"
import { formatClockTime, formatDate, toIntlLocale } from "@/utils/format"

/** 2024-01-07 is a Sunday, so adding `day_of_week` lands on the right weekday. */
const WEEK_ANCHOR = new Date(2024, 0, 7)

/**
 * Working-hours desk. These values are what `buildDaySlots` reads, so this
 * screen is the single control over which hours clients are offered: the
 * start and end of the day, the lunch break that no appointment may straddle,
 * and the days that are closed outright.
 */
export function ScheduleView() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const { rows, ready, providerId, save } = useProviderSchedule()

  // `resolveView` keeps this id out of reach without a `providers` row, but a
  // direct `?view=schedule` must not leave the spinner spinning forever.
  if (!providerId) {
    return <p className="text-cream/55 text-sm">{t("schedule.unavailable")}</p>
  }

  if (!ready) {
    return (
      <div className="border-cream/10 bg-ink-card/70 flex items-center gap-3 rounded-3xl border p-10">
        <Spinner className="text-gold size-5" />
        <p className="text-cream/55 text-sm">{t("schedule.loading")}</p>
      </div>
    )
  }

  // Keyed on the saved week so a successful write (or a reload) remounts the
  // editor with the new baseline instead of reconciling two sources of truth.
  return <ScheduleEditor key={JSON.stringify(rows)} rows={rows} save={save} locale={locale} />
}

interface ScheduleEditorProps {
  rows: ProviderScheduleRow[]
  save: (next: ProviderScheduleRow[]) => Promise<boolean>
  locale: string
}

function ScheduleEditor({ rows, save, locale }: ScheduleEditorProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ProviderScheduleRow[]>(rows)
  const [saving, setSaving] = useState(false)

  const errors = useMemo(() => {
    const map: Record<number, string> = {}
    for (const row of draft) {
      const key = validateDay(row)
      if (key) map[row.dayOfWeek] = key
    }
    return map
  }, [draft])

  const invalidDay = validateSchedule(draft)
  const dirty = JSON.stringify(draft) !== JSON.stringify(rows)
  const openDays = draft.filter((row) => !row.isDayOff).length
  const weeklyHours = weekMinutes(draft) / 60

  function updateDay(dayOfWeek: number, patch: Partial<ProviderScheduleRow>) {
    setDraft((current) =>
      current.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)),
    )
  }

  /** Copy one open day's window onto every other open day. */
  function applyToAll() {
    const source = draft.find((row) => !row.isDayOff && dayMinutes(row) > 0)
    if (!source) return
    setDraft((current) =>
      current.map((row) =>
        row.isDayOff
          ? row
          : {
              ...row,
              start: source.start,
              end: source.end,
              lunchStart: source.lunchStart,
              lunchEnd: source.lunchEnd,
            },
      ),
    )
  }

  async function handleSave() {
    setSaving(true)
    const ok = await save(draft)
    setSaving(false)
    toast(ok ? t("schedule.saved") : t("common.tryAgain"), ok ? "success" : "neutral")
  }

  return (
    <div className="space-y-6">
      <ViewHeading
        eyebrow={t("dashboard.nav.schedule")}
        title={t("schedule.title")}
        body={t("schedule.body")}
        actions={
          <>
            <Button variant="outline" onClick={applyToAll} disabled={openDays === 0}>
              {t("schedule.copyAll")}
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!dirty || Boolean(invalidDay)}
              iconLeft={<Icon name="check" className="size-4" />}
            >
              {t("schedule.save")}
            </Button>
          </>
        }
      />

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl border px-5 py-4 text-sm",
          openDays === 0
            ? "border-gold/30 bg-gold/5 text-gold"
            : "border-cream/10 bg-ink-card/70 text-cream/60",
        )}
      >
        <p className="inline-flex items-center gap-2">
          <Icon name={openDays === 0 ? "alert" : "clock"} className="size-4 shrink-0" />
          {openDays === 0
            ? t("schedule.summaryEmpty")
            : t("schedule.summary", {
                days: openDays,
                hours: weeklyHours.toLocaleString(locale, { maximumFractionDigits: 1 }),
              })}
        </p>

        {dirty && (
          <p className="text-gold inline-flex items-center gap-1.5 text-xs font-semibold">
            <span className="bg-gold size-1.5 shrink-0 rounded-full" />
            {t("schedule.unsaved")}
          </p>
        )}
      </div>

      <ul className="space-y-3">
        {draft.map((row) => (
          <DayRow
            key={row.dayOfWeek}
            row={row}
            error={errors[row.dayOfWeek]}
            locale={locale}
            onChange={(patch) => updateDay(row.dayOfWeek, patch)}
          />
        ))}
      </ul>

      <ul className="text-cream/45 space-y-1.5 text-xs leading-relaxed">
        {[t("schedule.lunchHint"), t("schedule.note")].map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface DayRowProps {
  row: ProviderScheduleRow
  error?: string
  locale: string
  onChange: (patch: Partial<ProviderScheduleRow>) => void
}

function DayRow({ row, error, locale, onChange }: DayRowProps) {
  const { t } = useTranslation()
  const off = row.isDayOff
  const label = formatDate(new Date(WEEK_ANCHOR.getTime() + row.dayOfWeek * 86_400_000), locale, {
    weekday: "long",
  })
  const minutes = dayMinutes(row)

  return (
    <li
      className={cn(
        "rounded-2xl border p-4 transition-colors md:p-5",
        off
          ? "border-cream/8 bg-cream/2"
          : error
            ? "bg-ink-card/70 border-red-400/40"
            : "border-cream/10 bg-ink-card/70",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="font-display text-lg font-semibold">{label}</h2>
          {!off && minutes > 0 && (
            <span className="text-cream/40 text-xs tabular-nums">
              {t("schedule.dayHours", {
                hours: (minutes / 60).toLocaleString(locale, { maximumFractionDigits: 1 }),
              })}
            </span>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={off}
          onClick={() => onChange({ isDayOff: !off })}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2.5 rounded-full border px-3.5 text-sm font-medium transition",
            off
              ? "border-gold/40 bg-gold/10 text-gold-soft"
              : "border-cream/15 text-cream/60 hover:border-cream/40 hover:text-cream",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative h-4 w-7 rounded-full transition-colors",
              off ? "bg-gold" : "bg-cream/20",
            )}
          >
            <span
              className={cn(
                "bg-ink absolute top-0.5 size-3 rounded-full transition-all",
                off ? "left-3.5" : "left-0.5",
              )}
            />
          </span>
          {off ? t("schedule.dayOff") : t("schedule.working")}
        </button>
      </div>

      {!off && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TimeField
              label={t("schedule.start")}
              value={row.start}
              onChange={(value) => onChange({ start: value })}
            />
            <TimeField
              label={t("schedule.end")}
              value={row.end}
              onChange={(value) => onChange({ end: value })}
            />
            <TimeField
              label={t("schedule.lunchStart")}
              value={row.lunchStart}
              onChange={(value) => onChange({ lunchStart: value })}
            />
            <TimeField
              label={t("schedule.lunchEnd")}
              value={row.lunchEnd}
              onChange={(value) => onChange({ lunchEnd: value })}
            />
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-300">
          <Icon name="alert" className="size-3.5 shrink-0" />
          {t(error)}
        </p>
      )}
    </li>
  )
}

interface TimeFieldProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
}

/**
 * One native time input. `color-scheme: dark` keeps the picker on-brand.
 *
 * The control paints its value in the *browser's* locale, so a machine set to a
 * 24h clock shows `15:00` while the rest of the app reads `3:00 PM`. When there
 * is a value, the painted text is made transparent and the app's own 12h label
 * sits on top of it: the input still holds the stored `HH:MM` string and keeps
 * its picker, its validation and its keyboard behaviour, only the display is
 * ours. An empty field is left alone -- `--:--` carries no hour cycle to
 * disagree about.
 */
function TimeField({ label, value, onChange }: TimeFieldProps) {
  const id = useId()
  const { i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-cream/45 text-[11px] font-semibold tracking-[0.14em] uppercase"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="time"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
          className={cn(
            fieldInputClasses,
            "h-10 font-medium tabular-nums",
            "border-cream/15",
            value && "text-transparent caret-transparent [-webkit-text-fill-color:transparent]",
          )}
        />
        {value && (
          <span
            aria-hidden="true"
            className="text-cream pointer-events-none absolute inset-0 flex items-center px-3.5 text-sm font-medium tabular-nums"
          >
            {formatClockTime(value, locale)}
          </span>
        )}
      </div>
    </div>
  )
}
