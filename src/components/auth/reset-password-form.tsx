"use client"

import Link from "next/link"
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PasswordField } from "@/components/ui/text-field"
import { createResetPasswordSchema, type ResetPasswordValues } from "@/libs/validation/auth"
import { updatePassword } from "@/services/auth.service"
import { translateAuthError } from "@/utils/auth-error"
import { fieldErrorsFrom } from "@/utils/zod"

export function ResetPasswordForm() {
  const { t } = useTranslation()

  const schema = useMemo(() => createResetPasswordSchema((key) => t(key)), [t])
  const [values, setValues] = useState<ResetPasswordValues>({ password: "", confirmPassword: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  function revalidate(next: ResetPasswordValues) {
    const parsed = schema.safeParse(next)
    setErrors(parsed.success ? {} : fieldErrorsFrom(parsed.error))
  }

  function handleChange(field: keyof ResetPasswordValues) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const next = { ...values, [field]: event.target.value }
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
    const result = await updatePassword(parsed.data.password)
    setLoading(false)

    if (!result.ok) {
      const sessionFailure =
        result.errorCode === "session_not_found" || result.errorCode === "refresh_token_not_found"
      setFormError(sessionFailure ? t("auth.reset.invalidSession") : translateAuthError(result, t))
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <h1 className="font-display text-2xl font-semibold">{t("auth.reset.title")}</h1>
        <Alert tone="success">{t("auth.reset.success")}</Alert>
        <Link
          href="/auth/login?role=customer"
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
        <h1 className="font-display text-2xl font-semibold">{t("auth.reset.title")}</h1>
        <p className="text-cream/55 text-sm">{t("auth.reset.subtitle")}</p>
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <PasswordField
          name="password"
          autoComplete="new-password"
          label={t("auth.reset.password")}
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
          label={t("auth.reset.confirmPassword")}
          value={values.confirmPassword}
          onChange={handleChange("confirmPassword")}
          error={errors.confirmPassword}
          showLabel={t("auth.fields.showPassword")}
          hideLabel={t("auth.fields.hidePassword")}
          required
        />

        <Button type="submit" loading={loading} className="w-full">
          {loading ? t("common.loading") : t("auth.reset.submit")}
        </Button>
      </form>
    </div>
  )
}
