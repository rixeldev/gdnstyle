import { z } from "zod"

/** Minimal translate signature so schemas stay decoupled from react-i18next. */
export type TranslateFn = (key: string) => string

const emailField = (t: TranslateFn) =>
  z.string().trim().min(1, t("validation.emailRequired")).email(t("validation.email"))

const passwordField = (t: TranslateFn) =>
  z
    .string()
    .min(8, t("validation.passwordMin"))
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, t("validation.passwordComplexity"))

export function createSignInSchema(t: TranslateFn) {
  return z.object({
    email: emailField(t),
    password: z.string().min(1, t("validation.passwordRequired")),
  })
}

export type SignInValues = z.infer<ReturnType<typeof createSignInSchema>>

export function createSignUpSchema(t: TranslateFn) {
  return z
    .object({
      role: z.enum(["customer", "professional"]),
      fullName: z.string().trim().min(2, t("validation.fullNameMin")),
      email: emailField(t),
      // Optional for customers (booking can collect it later), required for
      // professionals — enforced by the superRefine below.
      phone: z
        .string()
        .trim()
        .regex(/^$|^[\d\s()+-]{7,20}$/, t("validation.phoneInvalid")),
      city: z.string().trim().max(80, t("validation.cityMax")),
      instagram: z
        .string()
        .trim()
        .regex(/^$|^@?[A-Za-z0-9._]{1,30}$/, t("validation.socialInvalid")),
      tiktok: z
        .string()
        .trim()
        .regex(/^$|^@?[A-Za-z0-9._]{1,30}$/, t("validation.socialInvalid")),
      password: passwordField(t),
      confirmPassword: z.string().min(1, t("validation.passwordRequired")),
      terms: z.literal(true, { error: t("validation.termsRequired") }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      error: t("validation.passwordMismatch"),
      path: ["confirmPassword"],
    })
    .superRefine((data, ctx) => {
      // The professional directory needs a contact phone from day one.
      if (data.role === "professional" && data.phone.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["phone"],
          message: t("validation.phoneRequired"),
        })
      }
    })
}

export type SignUpValues = z.infer<ReturnType<typeof createSignUpSchema>>

export function createForgotPasswordSchema(t: TranslateFn) {
  return z.object({
    email: emailField(t),
  })
}

export type ForgotPasswordValues = z.infer<ReturnType<typeof createForgotPasswordSchema>>

export function createResetPasswordSchema(t: TranslateFn) {
  return z
    .object({
      password: passwordField(t),
      confirmPassword: z.string().min(1, t("validation.passwordRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      error: t("validation.passwordMismatch"),
      path: ["confirmPassword"],
    })
}

export type ResetPasswordValues = z.infer<ReturnType<typeof createResetPasswordSchema>>
