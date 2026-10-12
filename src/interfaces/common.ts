export type IconName =
  | "scissors"
  | "eye"
  | "sparkles"
  | "droplet"
  | "brush"
  | "flower"
  | "calendar"
  | "list"
  | "images"
  | "map-pin"
  | "map"
  | "navigation"
  | "wallet"
  | "badge-check"
  | "search"
  | "credit-card"
  | "star"
  | "heart"
  | "menu"
  | "close"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-up-right"
  | "check"
  | "check-circle"
  | "alert"
  | "eye-off"
  | "mail"
  | "phone"
  | "clock"
  | "globe"
  | "shield"
  | "bell"
  | "users"
  | "sliders"
  | "trash"
  | "apple"
  | "google"
  | "play"

export interface Category {
  /** Canonical id — matches `Venue["categoryId"]` (camelCase). */
  id: string
  /** URL slug used by `/locales/categoria/[slug]`. */
  slug: string
  labelKey: string
  icon: IconName
}

export interface Feature {
  index: string
  titleKey: string
  descriptionKey: string
  icon: IconName
}
