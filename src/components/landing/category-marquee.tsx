"use client"

import { useTranslation } from "react-i18next"

import { CATEGORIES } from "@/constants/categories"

/**
 * How many times the category list is repeated inside the scrolling track.
 *
 * The track is translated by exactly half its width (`-50%`), so the loop
 * looks seamless only while the strip (viewport) is never wider than the
 * copies left after the loop point. With just two copies the strip ran out of
 * words on desktop, went blank at the right edge and the words popped back in
 * when the loop restarted. Ten copies make the track (~10 copy-widths, 5 of
 * them "ahead" of the loop point) wider than any common display, and the even
 * count keeps half the track aligned exactly to a copy boundary.
 */
const COPIES = 10

export function CategoryMarquee() {
  const { t } = useTranslation()

  return (
    <div
      role="region"
      aria-label={t("landing.strip.label")}
      className="border-cream/10 relative border-y bg-[linear-gradient(90deg,#0d0712,#210735_50%,#0d0712)] py-4"
    >
      {/* Edge fades hide any remaining seam of the loop and ease entries/exits. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-[#0d0712] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-[#0d0712] to-transparent"
      />

      <div className="overflow-hidden">
        {/* Copies are `shrink-0` so they can never end up with different widths,
            and the track gets its own GPU layer to keep the motion smooth. */}
        <div className="motion-safe:animate-marquee flex w-max items-center will-change-transform">
          {[...Array(COPIES).keys()].map((copy) => (
            <ul
              key={copy}
              aria-hidden={copy > 0 || undefined}
              className="flex shrink-0 items-center"
            >
              {CATEGORIES.map((category) => (
                <li key={category.id} className="flex items-center">
                  <span className="text-cream/70 px-6 text-sm tracking-[0.22em] uppercase">
                    {t(category.labelKey)}
                  </span>
                  <span aria-hidden="true" className="bg-gold h-1 w-1 rounded-full" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  )
}
