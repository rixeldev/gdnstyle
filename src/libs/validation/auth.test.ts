import { describe, expect, it } from "vitest"

import { createSignInSchema, createSignUpSchema } from "@/libs/validation/auth"
import { fieldErrorsFrom } from "@/utils/zod"

/** The schemas only need the key back; the locales own the wording. */
const t = (key: string) => key

const validCustomer = {
  role: "customer" as const,
  fullName: "Ana Perez",
  email: "ana@example.com",
  phone: "",
  city: "Miami",
  instagram: "",
  tiktok: "",
  password: "@Gs_123456",
  confirmPassword: "@Gs_123456",
  terms: true as const,
}

describe("createSignUpSchema", () => {
  it("accepts a complete customer", () => {
    expect(createSignUpSchema(t).safeParse(validCustomer).success).toBe(true)
  })

  it("requires a password of eight characters mixing letters and digits", () => {
    const tooShort = createSignUpSchema(t).safeParse({
      ...validCustomer,
      password: "Ab1",
      confirmPassword: "Ab1",
    })
    expect(tooShort.success).toBe(false)
    if (!tooShort.success) {
      expect(fieldErrorsFrom(tooShort.error).password).toBe("validation.passwordMin")
    }

    const noDigit = createSignUpSchema(t).safeParse({
      ...validCustomer,
      password: "abcdefghijkl",
      confirmPassword: "abcdefghijkl",
    })
    expect(noDigit.success).toBe(false)
    if (!noDigit.success) {
      expect(fieldErrorsFrom(noDigit.error).password).toBe("validation.passwordComplexity")
    }
  })

  it("refuses a mismatched confirmation", () => {
    const result = createSignUpSchema(t).safeParse({
      ...validCustomer,
      confirmPassword: "@Gs_1234567",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(fieldErrorsFrom(result.error).confirmPassword).toBe("validation.passwordMismatch")
    }
  })

  it("insists on the terms before creating an account", () => {
    const result = createSignUpSchema(t).safeParse({ ...validCustomer, terms: false })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(fieldErrorsFrom(result.error).terms).toBe("validation.termsRequired")
    }
  })

  it("asks a professional for the phone the directory shows", () => {
    const result = createSignUpSchema(t).safeParse({
      ...validCustomer,
      role: "professional",
      phone: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(fieldErrorsFrom(result.error).phone).toBe("validation.phoneRequired")
    }
  })

  it("accepts a professional who does give the phone", () => {
    const result = createSignUpSchema(t).safeParse({
      ...validCustomer,
      role: "professional",
      phone: "+1 305 555 0100",
    })
    expect(result.success).toBe(true)
  })
})

describe("createSignInSchema", () => {
  it("refuses an unusable email and an empty password", () => {
    const result = createSignInSchema(t).safeParse({ email: "nope", password: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = fieldErrorsFrom(result.error)
      expect(errors.email).toBe("validation.email")
      expect(errors.password).toBe("validation.passwordRequired")
    }
  })
})
