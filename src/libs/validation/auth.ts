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
      password: passwordField(t),
      confirmPassword: z.string().min(1, t("validation.passwordRequired")),
      terms: z.literal(true, { error: t("validation.termsRequired") }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      error: t("validation.passwordMismatch"),
      path: ["confirmPassword"],
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
