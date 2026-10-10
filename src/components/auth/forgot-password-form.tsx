"use client"

import Link from "next/link"
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { TextField } from "@/components/ui/text-field"
import { createForgotPasswordSchema, type ForgotPasswordValues } from "@/libs/validation/auth"
import { sendPasswordReset } from "@/services/auth.service"
import { translateAuthError } from "@/utils/auth-error"
import { fieldErrorsFrom } from "@/utils/zod"

export function ForgotPasswordForm() {
  const { t } = useTranslation()

  const schema = useMemo(() => createForgotPasswordSchema((key) => t(key)), [t])
  const [values, setValues] = useState<ForgotPasswordValues>({ email: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sentEmail, setSentEmail] = useState("")

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setValues({ email: event.target.value })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError("")

    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error))
      return
    }

    setErrors({})
    setLoading(true)
    const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset-password`
    const result = await sendPasswordReset(parsed.data.email, redirectTo)
    setLoading(false)

    if (!result.ok) {
      setFormError(translateAuthError(result, t))
      return
    }

    setSentEmail(parsed.data.email)
  }

  if (sentEmail) {
    return (
      <div className="space-y-5 text-center">
        <div className="border-gold/40 bg-gold/10 text-gold mx-auto flex h-12 w-12 items-center justify-center rounded-full border">
          <Icon name="mail" className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold">{t("auth.forgot.successTitle")}</h1>
        <p className="text-cream/60 text-sm leading-relaxed">
          {t("auth.forgot.successBody", { email: sentEmail })}
        </p>
        <Link
          href="/auth/login?role=customer"
          className="text-gold inline-block text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("auth.forgot.backToLogin")}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">{t("auth.forgot.title")}</h1>
        <p className="text-cream/55 text-sm">{t("auth.forgot.subtitle")}</p>
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          name="email"
          type="email"
          autoComplete="email"
          label={t("auth.login.email")}
          placeholder={t("auth.login.emailPlaceholder")}
          value={values.email}
          onChange={handleChange}
          error={errors.email}
          required
        />

        <Button type="submit" loading={loading} className="w-full">
          {loading ? t("auth.status.sending") : t("auth.forgot.submit")}
        </Button>
      </form>

      <p className="text-cream/55 text-center text-sm">
        <Link
          href="/auth/login?role=customer"
          className="text-gold font-semibold underline-offset-4 hover:underline"
        >
          {t("auth.forgot.backToLogin")}
        </Link>
      </p>
    </div>
  )
}
