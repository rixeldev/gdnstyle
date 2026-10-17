import { describe, expect, it } from "vitest"

import {
  appointmentDisplayStatus,
  canClientModify,
  CLIENT_CHANGE_WINDOW_MIN,
  isHistoryBooking,
  minutesUntilStart,
} from "@/utils/appointment-status"
import { timeslotEpoch } from "@/utils/date"

const DATE = "2030-01-07"
const TIME = "10:00"
const MINUTE = 60_000
const start = timeslotEpoch(DATE, TIME)

const booking = { date: DATE, time: TIME, durationMinutes: 30 }

describe("appointmentDisplayStatus", () => {
  it("keeps cancelled terminal, whatever the clock says", () => {
    expect(appointmentDisplayStatus({ ...booking, status: "cancelled" }, start - 60 * MINUTE)).toBe(
      "cancelled",
    )
  })

  it("keeps a confirmed appointment confirmed after its own hour", () => {
    expect(appointmentDisplayStatus({ ...booking, status: "confirmed" }, start + 60 * MINUTE)).toBe(
      "confirmed",
    )
  })

  it("reads the legacy completed value as confirmed", () => {
    expect(appointmentDisplayStatus({ ...booking, status: "completed" }, start)).toBe("confirmed")
  })

  it("turns a pending appointment overdue once its duration elapsed", () => {
    expect(appointmentDisplayStatus(booking, start + 30 * MINUTE)).toBe("pending")
    expect(appointmentDisplayStatus(booking, start + 30 * MINUTE + 1)).toBe("overdue")
  })

  it("defaults the duration to 30 minutes when the row has none", () => {
    const noDuration = { date: DATE, time: TIME, durationMinutes: null }
    expect(appointmentDisplayStatus(noDuration, start + 30 * MINUTE + 1)).toBe("overdue")
  })
})

describe("canClientModify", () => {
  it("locks at the 1h30m window the cancellation copy promises", () => {
    expect(CLIENT_CHANGE_WINDOW_MIN).toBe(90)
    expect(canClientModify(booking, start - 91 * MINUTE)).toBe(true)
    expect(canClientModify(booking, start - 90 * MINUTE)).toBe(true)
    expect(canClientModify(booking, start - 89 * MINUTE)).toBe(false)
  })

  it("locks an appointment that has already started", () => {
    expect(canClientModify(booking, start - MINUTE)).toBe(false)
    expect(canClientModify(booking, start)).toBe(false)
  })
})

describe("minutesUntilStart", () => {
  it("counts the minutes up to the slot and reads zero once it begins", () => {
    expect(minutesUntilStart(booking, start - 45 * MINUTE - 20_000)).toBe(46)
    expect(minutesUntilStart(booking, start)).toBe(0)
  })
})

describe("isHistoryBooking", () => {
  it("sends cancelled and past confirmed rows to history, keeps the rest active", () => {
    expect(isHistoryBooking("cancelled", DATE, TIME, start - MINUTE)).toBe(true)
    expect(isHistoryBooking("confirmed", DATE, TIME, start + MINUTE)).toBe(true)
    expect(isHistoryBooking("confirmed", DATE, TIME, start - MINUTE)).toBe(false)
    expect(isHistoryBooking("pending", DATE, TIME, start + MINUTE)).toBe(false)
    // Overdue stays active: nobody confirmed it, so both sides must still act.
    expect(isHistoryBooking("overdue", DATE, TIME, start + MINUTE)).toBe(false)
  })
})

describe("the provider's clock", () => {
  const zoned = { ...booking, timeZone: "America/New_York" }
  const zonedStart = timeslotEpoch(DATE, TIME, "America/New_York")

  it("measures the 1h30m window in the venue's zone, not the browser's", () => {
    expect(canClientModify(zoned, zonedStart - 91 * MINUTE)).toBe(true)
    expect(canClientModify(zoned, zonedStart - 89 * MINUTE)).toBe(false)
  })

  it("turns overdue against the venue's clock", () => {
    const endsAt = zonedStart + 30 * MINUTE
    expect(appointmentDisplayStatus(zoned, endsAt)).toBe("pending")
    expect(appointmentDisplayStatus(zoned, endsAt + 1)).toBe("overdue")
  })

  it("sends a past confirmed row to history in the venue's zone too", () => {
    expect(isHistoryBooking("confirmed", DATE, TIME, zonedStart + MINUTE, "America/New_York")).toBe(
      true,
    )
  })
})
