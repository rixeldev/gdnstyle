"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { RoleSwitch } from "@/components/auth/role-switch"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { PasswordField, TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { useAuthedRedirect } from "@/hooks/use-authed-redirect"
import type { UserRole } from "@/interfaces/auth"
import { DEMO_USERS, type DemoUser } from "@/libs/auth/demo"
import { isSupabaseConfigured } from "@/libs/supabase/env"
import { createSignInSchema, type SignInValues } from "@/libs/validation/auth"
import { signInWithGoogle, signInWithPassword } from "@/services/auth.service"
import { translateAuthError } from "@/utils/auth-error"
import { fieldErrorsFrom } from "@/utils/zod"

function parseRole(value: string | null): UserRole {
  return value === "professional" ? "professional" : "customer"
}

export function LoginForm() {
  const { t } = useTranslation()
  const router = useRouter()
  // Already signed in? Leave the auth screens for the role-aware dashboard.
  const alreadyAuthed = useAuthedRedirect()
  const searchParams = useSearchParams()
  const role = parseRole(searchParams.get("role"))
  const linkError = searchParams.get("error") ? t("errors.auth.sessionExpired") : ""
  // `next` carries the place the visitor was heading to (e.g. a venue page),
  // so login returns them there instead of the dashboard.
  const nextParam = searchParams.get("next")
  const nextAfterLogin = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard"

  const schema = useMemo(() => createSignInSchema((key) => t(key)), [t])
  const [values, setValues] = useState<SignInValues>({ email: "", password: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState("")
  const [success, setSuccess] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  function handleRoleChange(next: UserRole) {
    const preserveNext =
      nextParam && nextParam.startsWith("/") ? `&next=${encodeURIComponent(nextParam)}` : ""
    router.replace(`/auth/login?role=${next}${preserveNext}`, { scroll: false })
  }

  function handleChange(field: keyof SignInValues) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const next = { ...values, [field]: event.target.value }
      setValues(next)
      if (submitted) {
        const parsed = schema.safeParse(next)
        setErrors(parsed.success ? {} : fieldErrorsFrom(parsed.error))
      }
    }
  }

  /** Load one of the documented demo accounts into the form. */
  function fillDemo(account: DemoUser) {
    setValues({ email: account.email, password: account.password })
    setErrors({})
    setFormError("")
    setSuccess("")
    if (account.role !== role) handleRoleChange(account.role)
    toast(t("auth.demo.filled"), "neutral")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setFormError("")
    setSuccess("")

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
    const result = await signInWithPassword(parsed.data)
    setLoading(false)

    if (!result.ok) {
      setFormError(translateAuthError(result, t))
      return
    }

    setSuccess(t("auth.login.success"))
    router.replace(nextAfterLogin)
    router.refresh()
  }

  async function handleGoogle() {
    setFormError("")
    setSuccess("")
    setGoogleLoading(true)
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextAfterLogin)}`
    const result = await signInWithGoogle(role, redirectTo)
    setGoogleLoading(false)

    if (!result.ok) {
      setFormError(translateAuthError(result, t))
      return
    }

    // With Supabase configured the browser is redirected to Google; the demo
    // layer signs in immediately, so continue here.
    if (!isSupabaseConfigured) {
      setSuccess(t("auth.login.success"))
      router.replace(nextAfterLogin)
      router.refresh()
    }
  }

  // The session arrived (another tab, or just signed in): hold the paint
  // while `router.replace` takes over.
  if (alreadyAuthed) return null

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">{t("auth.login.title")}</h1>
        <p className="text-cream/55 text-sm">
          {role === "professional"
            ? t("auth.login.subtitleProfessional")
            : t("auth.login.subtitleCustomer")}
        </p>
      </div>

      <RoleSwitch value={role} onChange={handleRoleChange} />

      {!isSupabaseConfigured && (
        <div className="border-cream/10 bg-cream/3 rounded-2xl border p-4">
          <p className="text-cream/60 text-[11px] font-semibold tracking-[0.16em] uppercase">
            {t("auth.demo.credentialsTitle")}
          </p>
          <p className="text-cream/45 mt-1 text-xs">{t("auth.demo.body")}</p>
          <div className="mt-3 space-y-2">
            {DEMO_USERS.map((account) => (
              <div
                key={account.id}
                className="border-cream/10 bg-ink/40 flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-cream text-xs font-semibold">
                    {t(
                      account.role === "professional"
                        ? "auth.demo.professional"
                        : "auth.demo.client",
                    )}
                  </p>
                  <p className="text-cream/45 truncate text-[11px]">
                    {account.email} · {account.password}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => fillDemo(account)}
                >
                  {t("auth.demo.use")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(formError || linkError) && <Alert tone="error">{formError || linkError}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          name="email"
          type="email"
          autoComplete="email"
          label={t("auth.login.email")}
          placeholder={t("auth.login.emailPlaceholder")}
          value={values.email}
          onChange={handleChange("email")}
          error={errors.email}
          required
        />

        <div className="space-y-2">
          <PasswordField
            name="password"
            autoComplete="current-password"
            label={t("auth.login.password")}
            value={values.password}
            onChange={handleChange("password")}
            error={errors.password}
            showLabel={t("auth.fields.showPassword")}
            hideLabel={t("auth.fields.hidePassword")}
            required
          />
          <div className="text-right">
            <Link
              href={`/auth/forgot-password?role=${role}`}
              className="text-cream/55 hover:text-gold text-xs underline-offset-4 transition hover:underline"
            >
              {t("auth.login.forgot")}
            </Link>
          </div>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          {loading ? t("auth.status.signingIn") : t("auth.login.submit")}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="bg-cream/10 h-px flex-1" />
        <span className="text-cream/40 text-xs uppercase">{t("auth.google.or")}</span>
        <span className="bg-cream/10 h-px flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        loading={googleLoading}
        onClick={handleGoogle}
        iconLeft={<Icon name="google" className="size-4" />}
      >
        {t("auth.google.button")}
      </Button>

      <p className="text-cream/55 text-center text-sm">
        {t("auth.login.noAccount")}{" "}
        <Link
          href={`/auth/signup?role=${role}`}
          className="text-gold font-semibold underline-offset-4 hover:underline"
        >
          {t("auth.login.signUpLink")}
        </Link>
      </p>
    </div>
  )
}
