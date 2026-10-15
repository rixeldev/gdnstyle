"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { toast } from "@/components/ui/toast"
import { useSession } from "@/libs/session"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"
import { uploadPortfolioImage } from "@/services/payments.service"

interface PortfolioPhoto {
  id: string
  image_url: string
  title: string | null
  created_at: string | null
}

/**
 * Portfolio gallery for the professional: photos go through the
 * `upload-portfolio-image` function (Storage + `provider_portfolio` row) and
 * the list is read straight from the table (RLS scopes it to its owner).
 */
export function ProviderPortfolioSection() {
  const { t } = useTranslation()
  const supabase = getSupabaseBrowserClient()
  const { user } = useSession()
  const userId = user?.id ?? null
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<PortfolioPhoto[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !userId) return
    const { data } = await supabase
      .from("provider_portfolio")
      .select("id, image_url, title, created_at")
      .eq("provider_id", userId)
      .order("created_at", { ascending: false })
      .limit(24)
    setPhotos((data ?? []) as PortfolioPhoto[])
  }, [supabase, userId])

  useEffect(() => {
    if (!supabase || !userId) return
    let active = true
    supabase
      .from("provider_portfolio")
      .select("id, image_url, title, created_at")
      .eq("provider_id", userId)
      .order("created_at", { ascending: false })
      .limit(24)
      .then(
        ({ data }) => {
          if (active) setPhotos((data ?? []) as PortfolioPhoto[])
        },
        () => {
          if (active) setPhotos([])
        },
      )
    return () => {
      active = false
    }
  }, [supabase, userId])

  if (!supabase) return null

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      await uploadPortfolioImage(file)
      toast(t("dashboard.professional.portfolio.uploaded"))
      await reload()
    } catch (error) {
      setMessage((error as Error).message || t("common.tryAgain"))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!supabase || !user?.id) return
    await supabase.from("provider_portfolio").delete().eq("id", id).eq("provider_id", user.id)
    setPhotos((current) => (current ?? []).filter((photo) => photo.id !== id))
  }

  return (
    <section className="border-cream/10 bg-ink-card rounded-4xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {t("dashboard.professional.portfolio.title")}
          </h2>
          <p className="text-cream/50 mt-1 text-sm">{t("dashboard.professional.portfolio.body")}</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={(event) => void handleUpload(event)}
        />
        <Button
          variant="outline"
          size="sm"
          loading={busy}
          onClick={() => fileRef.current?.click()}
          iconLeft={<Icon name="images" className="size-4" />}
        >
          {t("dashboard.professional.portfolio.upload")}
        </Button>
      </div>

      {message && <p className="text-danger mt-3 text-sm leading-relaxed">{message}</p>}

      {photos === null ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="bg-cream/5 aspect-square animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : photos.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-2xl">
              <Image
                src={photo.image_url}
                alt={photo.title ?? t("dashboard.professional.portfolio.title")}
                width={320}
                height={320}
                unoptimized
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => void handleDelete(photo.id)}
                aria-label={t("dashboard.professional.portfolio.remove")}
                className="bg-ink/80 text-cream/80 hover:text-danger absolute top-2 right-2 rounded-full p-1.5 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Icon name="trash" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-cream/10 mt-5 flex flex-col items-center gap-4 rounded-3xl border border-dashed px-6 py-8 text-center">
          <Icon name="images" className="text-cream/25 size-7" />
          <p className="text-cream/55 text-sm">{t("dashboard.professional.portfolio.empty")}</p>
        </div>
      )}
    </section>
  )
}
