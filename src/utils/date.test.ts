import { describe, expect, it } from "vitest"

import { timeslotEpoch } from "@/utils/date"

const DATE = "2030-01-07"
const SUMMER = "2030-07-07"
const TIME = "10:00"

describe("timeslotEpoch", () => {
  it("reads the pair in the given zone, not in the browser's", () => {
    // The same wall clock is 15:00 UTC in New York and 18:00 UTC in Los
    // Angeles in January: three hours apart, whatever the test machine says.
    const eastern = timeslotEpoch(DATE, TIME, "America/New_York")
    const pacific = timeslotEpoch(DATE, TIME, "America/Los_Angeles")

    expect(eastern).toBe(Date.UTC(2030, 0, 7, 15))
    expect(pacific).toBe(Date.UTC(2030, 0, 7, 18))
  })

  it("follows daylight saving inside one zone", () => {
    // New York is UTC-5 in January and UTC-4 in July.
    expect(timeslotEpoch(DATE, TIME, "America/New_York")).toBe(Date.UTC(2030, 0, 7, 15))
    expect(timeslotEpoch(SUMMER, TIME, "America/New_York")).toBe(Date.UTC(2030, 6, 7, 14))
  })

  it("keeps the browser's own clock when no zone is given", () => {
    expect(timeslotEpoch(DATE, TIME)).toBe(new Date(2030, 0, 7, 10, 0).getTime())
  })

  it("falls back to the browser's clock for a zone it cannot parse", () => {
    expect(timeslotEpoch(DATE, TIME, "Not/A_Zone")).toBe(timeslotEpoch(DATE, TIME))
  })
})
