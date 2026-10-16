import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { slotIsFree, type OccupiedSlot } from "@/services/appointments.service"
import {
  buildDaySlots,
  NO_SCHEDULE,
  toHhMm,
  toMinutes,
  type ProviderScheduleRow,
} from "@/services/availability.service"

/** A weekday far enough ahead that today's date never interferes. */
const DATE = "2030-01-07"
const DAY = new Date(2030, 0, 7)

function dayRow(overrides: Partial<ProviderScheduleRow> = {}): ProviderScheduleRow {
  return {
    dayOfWeek: DAY.getDay(),
    start: "09:00",
    end: "13:00",
    lunchStart: null,
    lunchEnd: null,
    isDayOff: false,
    ...overrides,
  }
}

describe("toMinutes / toHhMm", () => {
  it("reads HH:MM with or without seconds and rejects the rest", () => {
    expect(toMinutes("09:05")).toBe(545)
    expect(toMinutes("09:05:30")).toBe(545)
    expect(toMinutes("")).toBeNull()
    expect(toMinutes(null)).toBeNull()
    expect(toMinutes("aa:bb")).toBeNull()
  })

  it("formats minutes back into the clock the app displays", () => {
    expect(toHhMm(0)).toBe("00:00")
    expect(toHhMm(545)).toBe("09:05")
    expect(toHhMm(23 * 60 + 59)).toBe("23:59")
  })
})

describe("slotIsFree", () => {
  const taken: OccupiedSlot[] = [{ time: "10:00", durationMinutes: 60 }]

  it("refuses anything the booked interval already covers", () => {
    expect(slotIsFree(taken, "10:00", 30)).toBe(false)
    expect(slotIsFree(taken, "10:30", 30)).toBe(false)
  })

  it("allows the neighbours that only touch its edges", () => {
    expect(slotIsFree(taken, "09:30", 30)).toBe(true)
    expect(slotIsFree(taken, "11:00", 30)).toBe(true)
  })

  it("refuses a longer service that would grow into the next booking", () => {
    expect(slotIsFree(taken, "10:30", 60)).toBe(false)
  })

  it("treats an empty day as free", () => {
    expect(slotIsFree([], "09:00", 120)).toBe(true)
  })
})

describe("buildDaySlots", () => {
  beforeEach(() => {
    // The day before, so every hour of the target day is still ahead.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 0, 6, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("steps by the service's own duration and fits before the day ends", () => {
    expect(
      buildDaySlots({ dateKey: DATE, durationMinutes: 60, occupied: [], schedule: [dayRow()] }),
    ).toEqual(["09:00", "10:00", "11:00", "12:00"])
  })

  it("never offers a start that would straddle the lunch break", () => {
    expect(
      buildDaySlots({
        dateKey: DATE,
        durationMinutes: 60,
        occupied: [],
        schedule: [dayRow({ lunchStart: "12:00", lunchEnd: "13:00" })],
      }),
    ).toEqual(["09:00", "10:00", "11:00"])
  })

  it("hides every start a longer booking would occupy", () => {
    expect(
      buildDaySlots({
        dateKey: DATE,
        durationMinutes: 60,
        occupied: [{ time: "10:00", durationMinutes: 90 }],
        schedule: [dayRow()],
      }),
    ).toEqual(["09:00", "12:00"])
  })

  it("empties a weekday marked as a day off", () => {
    expect(
      buildDaySlots({
        dateKey: DATE,
        durationMinutes: 60,
        occupied: [],
        schedule: [dayRow({ isDayOff: true })],
      }),
    ).toEqual([])
  })

  it("falls back to the default window when the weekday has no row", () => {
    const slots = buildDaySlots({
      dateKey: DATE,
      durationMinutes: 60,
      occupied: [],
      schedule: NO_SCHEDULE,
    })
    expect(slots[0]).toBe("09:00")
    expect(slots.at(-1)).toBe("17:00")
    expect(slots).toHaveLength(9)
  })

  it("drops the hours already behind the visitor", () => {
    vi.setSystemTime(new Date(2030, 0, 7, 10, 30))
    expect(
      buildDaySlots({ dateKey: DATE, durationMinutes: 60, occupied: [], schedule: [dayRow()] }),
    ).toEqual(["11:00", "12:00"])
  })
})
