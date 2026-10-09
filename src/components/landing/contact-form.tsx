"use client"

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { TextField } from "@/components/ui/text-field"
import { SITE } from "@/constants/site"
import { createContactSchema, type ContactValues } from "@/libs/validation/contact"
import { fieldErrorsFrom } from "@/utils/zod"

/**
 * Contact form validated with Zod, embedded in the landing page. There is no
 * backend of record yet, so submitting opens the visitor's mail client with a
 * pre-filled message — an honest flow that never pretends data was stored.
 */
export function ContactForm() {
  const { t } = useTranslation()

  const schema = useMemo(() => createContactSchema((key) => t(key)), [t])
  const [values, setValues] = useState<ContactValues>({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [sent, setSent] = useState(false)

  function handleChange(field: keyof ContactValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = { ...values, [field]: event.target.value }
      setValues(next)
      if (submitted) {
        const parsed = schema.safeParse(next)
        setErrors(parsed.success ? {} : fieldErrorsFrom(parsed.error))
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const nextErrors = fieldErrorsFrom(parsed.error)
      setErrors(nextErrors)
      const first = Object.keys(nextErrors)[0]
      if (first) event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }

    setErrors({})
    const subject = encodeURIComponent(`[GDN Style] ${parsed.data.subject}`)
    const body = encodeURIComponent(
      `${parsed.data.message}\n\n— ${parsed.data.name} <${parsed.data.email}>`,
    )
    window.location.href = `mailto:${SITE.email}?subject=${subject}&body=${body}`
    setSent(true)
  }

  return (
    <div className="border-glow border-cream/10 bg-ink-card rounded-[2rem] border p-6 sm:p-8">
      <h3 className="font-display text-2xl font-semibold">{t("landing.contact.formTitle")}</h3>
      <p className="text-cream/55 mt-2 text-sm">{t("landing.contact.formNote")}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="name"
            autoComplete="name"
            label={t("landing.contact.name")}
            value={values.name}
            onChange={handleChange("name")}
            error={errors.name}
            required
          />
          <TextField
            name="email"
            type="email"
            autoComplete="email"
            label={t("landing.contact.email")}
            value={values.email}
            onChange={handleChange("email")}
            error={errors.email}
            required
          />
        </div>

        <TextField
          name="subject"
          label={t("landing.contact.subject")}
          value={values.subject}
          onChange={handleChange("subject")}
          error={errors.subject}
          required
        />

        <div className="space-y-2">
          <label
            htmlFor="landing-contact-message"
            className="text-cream/80 block text-sm font-medium"
          >
            {t("landing.contact.message")}
            <span className="text-gold ml-1" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="landing-contact-message"
            name="message"
            rows={5}
            placeholder={t("landing.contact.messagePlaceholder")}
            value={values.message}
            onChange={handleChange("message")}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? "landing-contact-message-error" : undefined}
            className="border-cream/15 bg-cream/[0.03] text-cream placeholder:text-cream/35 focus:border-gold/60 focus:bg-cream/[0.05] w-full resize-y rounded-xl border px-3.5 py-3 text-sm transition outline-none"
            required
          />
          {errors.message && (
            <p
              id="landing-contact-message-error"
              className="flex items-center gap-1.5 text-xs font-medium text-red-300"
            >
              <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
              {errors.message}
            </p>
          )}
        </div>

        {sent && <Alert tone="success">{t("landing.contact.note", { email: SITE.email })}</Alert>}

        <Button type="submit">{t("landing.contact.submit")}</Button>
      </form>
    </div>
  )
}
