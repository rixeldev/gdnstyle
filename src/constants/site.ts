import type { Feature, IconName } from "@/interfaces/common"

/** Public contact + brand constants (kept in sync with the reference). */
export const SITE = {
  name: "GDN Style",
  email: "support@gdnstyle.com",
  phone: "+1 (888) 913-5587",
  url: "https://www.gdnstyle.com",
  currency: "DOP",
} as const

export const NAV_LINKS = [
  { key: "nav.clients", href: "/#clients" },
  { key: "nav.professionals", href: "/#professionals" },
  { key: "nav.howItWorks", href: "/#how-it-works" },
  { key: "nav.app", href: "/#app" },
  { key: "nav.contact", href: "/#contact" },
] as const

export const FOOTER_NAV = [
  {
    titleKey: "landing.footer.explore",
    links: [
      { key: "nav.clients", href: "/#clients" },
      { key: "nav.professionals", href: "/#professionals" },
      { key: "nav.howItWorks", href: "/#how-it-works" },
      { key: "nav.app", href: "/#app" },
      { key: "landing.footer.payments", href: "/#payments" },
    ],
  },
  {
    titleKey: "landing.footer.help",
    links: [
      { key: "landing.footer.faq", href: "/faq" },
      { key: "landing.footer.contact", href: "/#contact" },
      { key: "landing.footer.privacy", href: "/policies" },
      { key: "landing.footer.terms", href: "/terms" },
    ],
  },
] as const

/** Hero phone carousel — real screenshots shipped in the repo. */
export const HERO_SCREENS = [
  {
    src: "/scrennshots/screen-2.jpeg",
    nameKey: "landing.hero.screens.home",
    altKey: "landing.hero.screens.home",
  },
  {
    src: "/scrennshots/screen-6.jpeg",
    nameKey: "landing.hero.screens.profile",
    altKey: "landing.hero.screens.profile",
  },
  {
    src: "/scrennshots/screen-4.jpeg",
    nameKey: "landing.hero.screens.booking",
    altKey: "landing.hero.screens.booking",
  },
] as const

/** Screenshots used by the "app" section (different from the hero carousel). */
export const APP_SCREENS = [
  { src: "/scrennshots/screen-1.jpeg", altKey: "landing.app.screens.welcome" },
  { src: "/scrennshots/screen-11.jpeg", altKey: "landing.app.screens.payments" },
  { src: "/scrennshots/screen-16.jpeg", altKey: "landing.app.screens.support" },
] as const

/** Small trust row under the hero CTAs. */
export const TRUST_ITEMS = [
  { key: "landing.hero.trust.secure", icon: "shield" },
  { key: "landing.hero.trust.cancel", icon: "calendar" },
  { key: "landing.hero.trust.reminders", icon: "bell" },
] as const satisfies ReadonlyArray<{ key: string; icon: IconName }>

export interface Stat {
  id: string
  value: number
  suffix: string
  decimals: number
  star?: boolean
}

/** Animated numbers shown in the stats band. */
export const STATS: Stat[] = [
  { id: "professionals", value: 1200, suffix: "+", decimals: 0 },
  { id: "bookings", value: 15000, suffix: "+", decimals: 0 },
  { id: "rating", value: 4.9, suffix: "", decimals: 1, star: true },
  { id: "cities", value: 25, suffix: "+", decimals: 0 },
]

export const CUSTOMER_FEATURES: Feature[] = [
  {
    index: "1",
    titleKey: "landing.clients.features.search.title",
    descriptionKey: "landing.clients.features.search.description",
    icon: "search",
  },
  {
    index: "2",
    titleKey: "landing.clients.features.portfolio.title",
    descriptionKey: "landing.clients.features.portfolio.description",
    icon: "images",
  },
  {
    index: "3",
    titleKey: "landing.clients.features.booking.title",
    descriptionKey: "landing.clients.features.booking.description",
    icon: "credit-card",
  },
]

export const PROFESSIONAL_FEATURES: Feature[] = [
  {
    index: "01",
    titleKey: "landing.professionals.features.agenda.title",
    descriptionKey: "landing.professionals.features.agenda.description",
    icon: "calendar",
  },
  {
    index: "02",
    titleKey: "landing.professionals.features.services.title",
    descriptionKey: "landing.professionals.features.services.description",
    icon: "list",
  },
  {
    index: "03",
    titleKey: "landing.professionals.features.portfolio.title",
    descriptionKey: "landing.professionals.features.portfolio.description",
    icon: "images",
  },
  {
    index: "04",
    titleKey: "landing.professionals.features.locations.title",
    descriptionKey: "landing.professionals.features.locations.description",
    icon: "map-pin",
  },
  {
    index: "05",
    titleKey: "landing.professionals.features.wallet.title",
    descriptionKey: "landing.professionals.features.wallet.description",
    icon: "wallet",
  },
  {
    index: "06",
    titleKey: "landing.professionals.features.verified.title",
    descriptionKey: "landing.professionals.features.verified.description",
    icon: "badge-check",
  },
]

export const HOW_IT_WORKS: Feature[] = [
  {
    index: "01",
    titleKey: "landing.howItWorks.steps.search.title",
    descriptionKey: "landing.howItWorks.steps.search.description",
    icon: "search",
  },
  {
    index: "02",
    titleKey: "landing.howItWorks.steps.book.title",
    descriptionKey: "landing.howItWorks.steps.book.description",
    icon: "calendar",
  },
  {
    index: "03",
    titleKey: "landing.howItWorks.steps.rate.title",
    descriptionKey: "landing.howItWorks.steps.rate.description",
    icon: "star",
  },
]

/** In-person payment terminals (transparent PNGs in /public/terminals). */
export const TERMINALS = [
  { id: "counter", src: "/terminals/terminal-1.png", width: 1024, height: 1536 },
  { id: "tap", src: "/terminals/terminal-2.png", width: 1024, height: 1024 },
  { id: "phone", src: "/terminals/terminal-3.png", width: 1536, height: 1024 },
] as const

/** App store listings. TODO: replace with the real listings once published. */
export const STORE_LINKS = [
  {
    id: "appstore",
    label: "App Store",
    icon: "apple",
    href: "https://apps.apple.com/app/gdn-style/id0000000000",
  },
  {
    id: "googleplay",
    label: "Google Play",
    icon: "play",
    href: "https://play.google.com/store/apps/details?id=com.gdnstyle.app",
  },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: IconName; href: string }>
