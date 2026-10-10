"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { Trans, useTranslation } from "react-i18next"

import { RoleSwitch } from "@/components/auth/role-switch"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { PasswordField, TextField } from "@/components/ui/text-field"
import type { UserRole } from "@/interfaces/auth"
import { isSupabaseConfigured } from "@/libs/supabase/env"
import { createSignUpSchema } from "@/libs/validation/auth"
import { resendConfirmationEmail, signUpWithPassword } from "@/services/auth.service"
import { translateAuthError } from "@/utils/auth-error"
import { fieldErrorsFrom } from "@/utils/zod"

interface SignUpFormState {
  role: UserRole
  fullName: string
  email: string
  password: string
  confirmPassword: string
  terms: boolean
}

function parseRole(value: string | null): UserRole {
  return value === "professional" ? "professional" : "customer"
}

export function SignUpForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const role = parseRole(searchParams.get("role"))

  const schema = useMemo(() => createSignUpSchema((key) => t(key)), [t])
  const [values, setValues] = useState<SignUpFormState>({
    role,
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [createdEmail, setCreatedEmail] = useState("")

  function revalidate(next: SignUpFormState) {
    const parsed = schema.safeParse(next)
    setErrors(parsed.success ? {} : fieldErrorsFrom(parsed.error))
  }

  function handleRoleChange(nextRole: UserRole) {
    const next = { ...values, role: nextRole }
    setValues(next)
    router.replace(`/auth/signup?role=${nextRole}`, { scroll: false })
    if (submitted) revalidate(next)
  }

  function handleChange(field: keyof SignUpFormState) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = field === "terms" ? event.target.checked : event.target.value
      const next = { ...values, [field]: value } as SignUpFormState
      setValues(next)
      if (submitted) revalidate(next)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setFormError("")

    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const nextErrors = fieldErrorsFrom(parsed.error)
      setErrors(nextErrors)
      const first = Object.keys(nextErrors)[0]
      if (first) event.currentTarget.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus()
      return
    }

    setErrors({})
    setLoading(true)

    const emailRedirectTo = `${window.location.origin}/auth/callback?next=/dashboard`
    const result = await signUpWithPassword(
      {
        email: parsed.data.email,
        password: parsed.data.password,
        fullName: parsed.data.fullName,
        role: parsed.data.role,
      },
      emailRedirectTo,
    )
    setLoading(false)

    if (!result.ok) {
      setFormError(translateAuthError(result, t))
      return
    }

    setCreatedEmail(parsed.data.email)
  }

  async function handleResend() {
    setResending(true)
    setResent(false)
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=/dashboard`
    const result = await resendConfirmationEmail(createdEmail, emailRedirectTo)
    setResending(false)
    if (result.ok) setResent(true)
    else setFormError(translateAuthError(result, t))
  }

  if (createdEmail) {
    return (
      <div className="space-y-5 text-center">
        <div className="border-gold/40 bg-gold/10 text-gold mx-auto flex h-12 w-12 items-center justify-center rounded-full border">
          <Icon name="mail" className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold">{t("auth.signup.successTitle")}</h1>
        <p className="text-cream/60 text-sm leading-relaxed">
          {t("auth.signup.successBody", { email: createdEmail })}
        </p>

        {resent && <Alert tone="success">{t("auth.signup.resent")}</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}

        <Button variant="outline" onClick={handleResend} loading={resending} className="w-full">
          {t("auth.signup.resend")}
        </Button>

        <Link
          href={`/auth/login?role=${role}`}
          className="text-gold inline-block text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("auth.login.title")}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">{t("auth.signup.title")}</h1>
        <p className="text-cream/55 text-sm">
          {role === "professional"
            ? t("auth.signup.subtitleProfessional")
            : t("auth.signup.subtitleCustomer")}
        </p>
      </div>

      <RoleSwitch value={role} onChange={handleRoleChange} />

      {!isSupabaseConfigured && (
        <Alert tone="info">
          <span className="font-semibold">{t("auth.unavailable.title")}</span>
          <br />
          {t("auth.unavailable.body")}
        </Alert>
      )}

      {formError && <Alert tone="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          name="fullName"
          autoComplete="name"
          label={t("auth.signup.fullName")}
          placeholder={t("auth.signup.fullNamePlaceholder")}
          value={values.fullName}
          onChange={handleChange("fullName")}
          error={errors.fullName}
          required
        />

        <TextField
          name="email"
          type="email"
          autoComplete="email"
          label={t("auth.signup.email")}
          placeholder={t("auth.signup.emailPlaceholder")}
          value={values.email}
          onChange={handleChange("email")}
          error={errors.email}
          required
        />

        <PasswordField
          name="password"
          autoComplete="new-password"
          label={t("auth.signup.password")}
          hint={t("auth.signup.passwordHint")}
          value={values.password}
          onChange={handleChange("password")}
          error={errors.password}
          showLabel={t("auth.fields.showPassword")}
          hideLabel={t("auth.fields.hidePassword")}
          required
        />

        <PasswordField
          name="confirmPassword"
          autoComplete="new-password"
          label={t("auth.signup.confirmPassword")}
          value={values.confirmPassword}
          onChange={handleChange("confirmPassword")}
          error={errors.confirmPassword}
          showLabel={t("auth.fields.showPassword")}
          hideLabel={t("auth.fields.hidePassword")}
          required
        />

        <div className="space-y-2">
          <label className="text-cream/70 flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="terms"
              checked={values.terms}
              onChange={handleChange("terms")}
              aria-invalid={errors.terms ? true : undefined}
              className="border-cream/30 accent-gold mt-0.5 size-4 shrink-0 rounded bg-transparent"
            />
            <span className="leading-relaxed">
              <Trans
                i18nKey="auth.signup.terms"
                components={{
                  terms: (
                    <Link
                      href="/terms"
                      className="text-gold font-medium underline-offset-4 hover:underline"
                    />
                  ),
                  privacy: (
                    <Link
                      href="/policies"
                      className="text-gold font-medium underline-offset-4 hover:underline"
                    />
                  ),
                }}
              />
            </span>
          </label>
          {errors.terms && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-300">
              <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
              {errors.terms}
            </p>
          )}
        </div>

        <Button type="submit" loading={loading} disabled={!isSupabaseConfigured} className="w-full">
          {loading ? t("auth.status.creating") : t("auth.signup.submit")}
        </Button>
      </form>

      <p className="text-cream/55 text-center text-sm">
        {t("auth.signup.hasAccount")}{" "}
        <Link
          href={`/auth/login?role=${role}`}
          className="text-gold font-semibold underline-offset-4 hover:underline"
        >
          {t("auth.signup.signInLink")}
        </Link>
      </p>
    </div>
  )
}
