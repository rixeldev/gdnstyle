"use client"

import { useId, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import type { SessionUser } from "@/libs/session"
import { updateProfile } from "@/services/auth.service"

interface ProfileDialogProps {
  open: boolean
  user: SessionUser
  onClose: () => void
}

/** Editable professional profile: display name, phone and a short bio. */
export function ProfileDialog({ open, user, onClose }: ProfileDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const [fullName, setFullName] = useState(user.fullName ?? "")
  const [phone, setPhone] = useState(user.phone ?? "")
  const [bio, setBio] = useState(user.bio ?? "")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (fullName.trim().length < 2) {
      setError(t("validation.fullNameMin"))
      return
    }

    setError("")
    setSaving(true)
    await updateProfile(user.id, {
      fullName: fullName.trim(),
      phone: phone.trim() || null,
      bio: bio.trim() || null,
    })
    setSaving(false)
    toast(t("dashboard.professional.profileSaved"))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="p-5">
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {t("dashboard.professional.editProfile")}
        </h2>
        <p className="text-cream/50 mt-1 text-sm">
          {t("dashboard.professional.editProfileSubtitle")}
        </p>

        <div className="mt-5 space-y-4">
          <TextField
            label={t("auth.signup.fullName")}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            error={error}
            required
          />

          <TextField
            label={t("dashboard.professional.phone")}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+1 809 000 0000"
            inputMode="tel"
            hint={t("common.optional")}
          />

          <div className="space-y-2">
            <label htmlFor="profile-bio" className="text-cream/80 block text-sm font-medium">
              {t("dashboard.professional.bio")}{" "}
              <span className="text-cream/40 font-normal">({t("common.optional")})</span>
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder={t("dashboard.professional.bioPlaceholder")}
              rows={3}
              maxLength={280}
              className="border-cream/15 bg-cream/3 text-cream placeholder:text-cream/35 focus:border-gold/60 focus:bg-cream/5 w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm transition outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
