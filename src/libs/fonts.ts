import { Cinzel, Cormorant_Garamond, Geist } from "next/font/google"

/**
 * Display serif used for headings and the wordmark, preserving the reference
 * brand voice. Kept to the weights we actually use.
 */
export const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
})

/**
 * Soft editorial serif used sparingly for romantic accents and pull quotes —
 * the "coquette" flourish on top of the brand serif.
 */
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
})

/** Clean sans for UI, navigation, body copy, forms and data. */
export const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
})
