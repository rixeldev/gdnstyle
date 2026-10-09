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
  | "wallet"
  | "badge-check"
  | "search"
  | "credit-card"
  | "star"
  | "menu"
  | "close"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "check"
  | "alert"
  | "eye-off"
  | "mail"
  | "phone"
  | "clock"
  | "globe"
  | "shield"
  | "bell"
  | "apple"
  | "play"

export interface Category {
  id: string
  labelKey: string
  icon: IconName
}

export interface Feature {
  index: string
  titleKey: string
  descriptionKey: string
  icon: IconName
}
