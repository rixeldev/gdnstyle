"use client"

import { useRouter } from "next/navigation"
import { useId, useState, type FormEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { PasswordField, TextArea, TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import type { SessionUser } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { createAccountSchema, createChangePasswordSchema } from "@/libs/validation/auth"
import { signInWithPassword, signOut, updatePassword, updateProfile } from "@/services/auth.service"
import { updateOwnedProvider } from "@/services/provider.service"
import { translateAuthError } from "@/utils/auth-error"
import { fieldErrorsFrom } from "@/utils/zod"

interface ProfileDialogProps {
  open: boolean
  user: SessionUser
  onClose: () => void
}

/** One labelled block of the dialog, headed the way the dashboard heads views. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-cream/10 border-t pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-gold text-[11px] font-semibold tracking-[0.22em] uppercase">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

/**
 * Account editor shared by both roles: personal details, where the account is,
 * and how to secure it. A professional edits two rows at once — `profiles` for
 * the account and `providers` for the card the marketplace renders (business
 * name, public address, socials). Migration 0007 is what finally lets that
 * second row be written; before it, signup froze it.
 */
export function ProfileDialog({ open, user, onClose }: ProfileDialogProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const titleId = useId()
  const isProfessional = user.providerId !== null

  const [fullName, setFullName] = useState(user.fullName ?? "")
  const [phone, setPhone] = useState(user.phone ?? "")
  const [bio, setBio] = useState(user.bio ?? "")
  const [businessName, setBusinessName] = useState(user.businessName ?? "")
  const [socials, setSocials] = useState(user.socials)
  const [address, setAddress] = useState(user.address)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Security block.
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const patchAddress = (key: keyof typeof address, value: string) =>
    setAddress((previous) => ({ ...previous, [key]: value || null }))

  const patchSocial = (key: keyof typeof socials, value: string) =>
    setSocials((previous) => ({ ...previous, [key]: value || null }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = createAccountSchema(t).safeParse({ fullName, phone })
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error))
      return
    }

    setErrors({})
    setSaving(true)

    const nextAddress = {
      line1: address.line1?.trim() || null,
      line2: address.line2?.trim() || null,
      city: address.city?.trim() || null,
      state: address.state?.trim() || null,
      postalCode: address.postalCode?.trim() || null,
      country: address.country?.trim() || null,
    }

    const profile = await updateProfile(user.id, {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      bio: bio.trim() || null,
      address: nextAddress,
    })

    // The public card is a second row and both writes have to land for the
    // dialog to claim it saved: name, phone and address are rendered from
    // `providers`, not from `profiles`.
    let cardSaved = true
    const supabase = getSupabaseBrowserClient()
    if (user.providerId && supabase) {
      cardSaved = await updateOwnedProvider(supabase, user.providerId, {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone || null,
        business_name: businessName.trim() || null,
        address_line1: nextAddress.line1,
        address_line2: nextAddress.line2,
        address_city: nextAddress.city,
        address_state: nextAddress.state,
        address_postal_code: nextAddress.postalCode,
        address_country: nextAddress.country,
        social_instagram: socials.instagram?.trim() || null,
        social_tiktok: socials.tiktok?.trim() || null,
        social_whatsapp: socials.whatsapp?.trim() || null,
      })
    }

    setSaving(false)

    if (!profile.ok || !cardSaved) {
      setErrors({ form: t("dashboard.account.saveFailed") })
      return
    }

    toast(t("dashboard.account.saved"))
    onClose()
  }

  async function handlePasswordSubmit() {
    const parsed = createChangePasswordSchema(t).safeParse({
      currentPassword,
      password: newPassword,
      confirmPassword,
    })
    if (!parsed.success) {
      setPasswordErrors(fieldErrorsFrom(parsed.error))
      return
    }

    if (parsed.data.password === parsed.data.currentPassword) {
      setPasswordErrors({ password: t("dashboard.account.passwordSame") })
      return
    }

    setPasswordErrors({})
    setPasswordSaving(true)

    // Supabase has no "is this the current password?" call, so verifying means
    // signing in again: a wrong password comes back as an error, a right one
    // just re-issues the session this tab already holds.
    const verified = user.email
      ? await signInWithPassword({ email: user.email, password: parsed.data.currentPassword })
      : { ok: false as const }

    if (!verified.ok) {
      setPasswordSaving(false)
      setPasswordErrors({ currentPassword: t("dashboard.account.currentPasswordWrong") })
      return
    }

    const result = await updatePassword(parsed.data.password, user.demo ? user.id : undefined)
    setPasswordSaving(false)

    if (!result.ok) {
      setPasswordErrors({ form: translateAuthError(result, t) })
      return
    }

    closePasswordForm()
    toast(t("dashboard.account.passwordUpdated"))
  }

  /** Closing the block drops what was typed: half a password is worse than none. */
  function closePasswordForm() {
    setShowPasswordForm(false)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordErrors({})
  }

  async function handleSignOutEverywhere() {
    setSigningOut(true)
    // `global` ends every session of the account, this tab included.
    await signOut("global")
    router.replace(`/auth/login?role=${user.role}`)
    router.refresh()
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <header className="border-cream/10 border-b px-5 py-4">
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {t("dashboard.account.editTitle")}
          </h2>
          <p className="text-cream/50 mt-1 text-sm">{t("dashboard.account.editSubtitle")}</p>
        </header>

        <div className="space-y-6 px-5 py-5">
          {errors.form && <Alert tone="error">{errors.form}</Alert>}

          <Section title={t("dashboard.account.sectionDetails")}>
            <TextField
              label={t("auth.signup.fullName")}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              error={errors.fullName}
              required
            />

            <TextField
              label={t("dashboard.account.phone")}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+1 212 555 0100"
              inputMode="tel"
              autoComplete="tel"
              hint={t("common.optional")}
              error={errors.phone}
            />

            <TextArea
              label={t("dashboard.professional.bio")}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder={t("dashboard.professional.bioPlaceholder")}
              maxLength={280}
              hint={t("common.optional")}
            />

            {isProfessional && (
              <>
                <TextField
                  label={t("dashboard.account.businessName")}
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder={t("dashboard.account.businessNamePlaceholder")}
                  hint={t("dashboard.account.businessNameHint")}
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <TextField
                    label={t("dashboard.account.instagram")}
                    value={socials.instagram ?? ""}
                    onChange={(event) => patchSocial("instagram", event.target.value)}
                    placeholder="@studio"
                  />
                  <TextField
                    label={t("dashboard.account.tiktok")}
                    value={socials.tiktok ?? ""}
                    onChange={(event) => patchSocial("tiktok", event.target.value)}
                    placeholder="@studio"
                  />
                  <TextField
                    label={t("dashboard.account.whatsapp")}
                    value={socials.whatsapp ?? ""}
                    onChange={(event) => patchSocial("whatsapp", event.target.value)}
                    placeholder="+1 212 555 0100"
                    inputMode="tel"
                  />
                </div>
              </>
            )}
          </Section>

          <Section title={t("dashboard.account.sectionLocation")}>
            <TextField
              label={t("dashboard.account.addressLine1")}
              value={address.line1 ?? ""}
              onChange={(event) => patchAddress("line1", event.target.value)}
              autoComplete="address-line1"
              placeholder="123 Bushwick Ave"
            />

            <TextField
              label={t("dashboard.account.addressLine2")}
              value={address.line2 ?? ""}
              onChange={(event) => patchAddress("line2", event.target.value)}
              autoComplete="address-line2"
              placeholder={t("dashboard.account.addressLine2Placeholder")}
              hint={t("common.optional")}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={t("dashboard.account.city")}
                value={address.city ?? ""}
                onChange={(event) => patchAddress("city", event.target.value)}
                autoComplete="address-level2"
                placeholder="Brooklyn"
              />
              <TextField
                label={t("dashboard.account.state")}
                value={address.state ?? ""}
                onChange={(event) => patchAddress("state", event.target.value)}
                autoComplete="address-level1"
                placeholder="NY"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={t("dashboard.account.postalCode")}
                value={address.postalCode ?? ""}
                onChange={(event) => patchAddress("postalCode", event.target.value)}
                autoComplete="postal-code"
                placeholder="11206"
              />
              <TextField
                label={t("dashboard.account.country")}
                value={address.country ?? ""}
                onChange={(event) => patchAddress("country", event.target.value)}
                autoComplete="country-name"
                placeholder="United States"
              />
            </div>

            <p className="text-cream/45 text-xs">{t("dashboard.account.locationHint")}</p>
          </Section>

          <Section title={t("dashboard.account.sectionSecurity")}>
            <div className="border-cream/10 bg-cream/3 rounded-2xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.account.passwordTitle")}</p>
                  <p className="text-cream/50 mt-1 text-xs leading-relaxed">
                    {t("dashboard.account.passwordBody")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    showPasswordForm ? closePasswordForm() : setShowPasswordForm(true)
                  }
                  disabled={passwordSaving}
                >
                  {showPasswordForm ? t("common.cancel") : t("dashboard.account.changePassword")}
                </Button>
              </div>

              {showPasswordForm && (
                // A <form> here would nest inside the account form above --
                // invalid HTML whose inner submit is the one that fires. The
                // button below calls the handler directly instead.
                <div className="mt-4 space-y-4">
                  <PasswordField
                    label={t("dashboard.account.currentPassword")}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    error={passwordErrors.currentPassword}
                    required
                    showLabel={t("auth.fields.showPassword")}
                    hideLabel={t("auth.fields.hidePassword")}
                  />

                  <PasswordField
                    label={t("dashboard.account.newPassword")}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    hint={t("auth.signup.passwordHint")}
                    error={passwordErrors.password}
                    required
                    showLabel={t("auth.fields.showPassword")}
                    hideLabel={t("auth.fields.hidePassword")}
                  />

                  <PasswordField
                    label={t("dashboard.account.confirmPassword")}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    error={passwordErrors.confirmPassword}
                    required
                    showLabel={t("auth.fields.showPassword")}
                    hideLabel={t("auth.fields.hidePassword")}
                  />

                  {passwordErrors.form && <Alert tone="error">{passwordErrors.form}</Alert>}

                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePasswordSubmit}
                    loading={passwordSaving}
                  >
                    {t("dashboard.account.updatePassword")}
                  </Button>
                </div>
              )}
            </div>

            <div className="border-cream/10 bg-cream/3 rounded-2xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.account.sessionsTitle")}</p>
                  <p className="text-cream/50 mt-1 text-xs leading-relaxed">
                    {t("dashboard.account.sessionsBody")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSignOutEverywhere}
                  loading={signingOut}
                >
                  {t("dashboard.account.signOutEverywhere")}
                </Button>
              </div>
            </div>
          </Section>
        </div>

        <footer className="border-cream/10 flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            {t("common.save")}
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
