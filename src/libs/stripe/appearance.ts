import type { StripeElementsOptions } from "@stripe/stripe-js"

type Appearance = NonNullable<StripeElementsOptions["appearance"]>

/**
 * Stripe Elements theme that mirrors the page design tokens from
 * `globals.css` (ink-card #111111, cream #f4f1ea, gold #e0b044).
 *
 * Built on Stripe's native dark `night` theme — so no subcomponent can fall
 * back to the default white — then fine-tuned with per-variable overrides
 * and per-selector rules to match the app's inputs (rounded-xl, cream
 * border, gold focus ring). Only variables supported by stripe-js v10 are
 * used: deprecated aliases (`colorIcon`, `colorDangerText`) and unknown keys
 * are silently ignored by Stripe and would leak the default styling.
 */
export const stripeAppearance: Appearance = {
  theme: "night",
  variables: {
    fontFamily: "var(--font-geist), ui-sans-serif, system-ui, sans-serif",
    fontSizeBase: "14px",
    spacingUnit: "6px",
    borderRadius: "12px",
    buttonBorderRadius: "12px",

    colorPrimary: "#e0b044",
    // Slightly above ink-card so fields read as inputs inside the panel.
    colorBackground: "#161616",
    colorText: "#f4f1ea",
    colorTextSecondary: "rgba(244, 241, 234, 0.6)",
    colorTextPlaceholder: "rgba(244, 241, 234, 0.35)",
    colorSuccess: "#4ade80",
    colorDanger: "#f87171",
    accessibleColorOnColorPrimary: "#1a1408",
    accessibleColorOnColorDanger: "#fca5a5",

    iconColor: "rgba(244, 241, 234, 0.6)",
    iconHoverColor: "#f4f1ea",
    tabIconColor: "rgba(244, 241, 234, 0.6)",
    tabIconSelectedColor: "#e0b044",
    logoColor: "rgba(244, 241, 234, 0.55)",
    tabLogoSelectedColor: "#e0b044",

    inputColorBorder: "rgba(244, 241, 234, 0.15)",
    inputBoxShadow: "none",
    inputFocusColorBorder: "rgba(224, 176, 68, 0.6)",
    inputFocusBoxShadow: "0 0 0 1.5px rgba(224, 176, 68, 0.35)",
    focusBoxShadow: "0 0 0 1.5px rgba(224, 176, 68, 0.35)",

    labelColorText: "rgba(244, 241, 234, 0.8)",
    buttonColorBackground: "#e0b044",
    buttonColorText: "#1a1408",
    buttonBoxShadow: "none",
  },
  rules: {
    ".Label": {
      color: "rgba(244, 241, 234, 0.8)",
      fontSize: "13px",
      fontWeight: "500",
      marginBottom: "6px",
    },
    ".Title": { color: "#f4f1ea" },
    ".Body": { color: "rgba(244, 241, 234, 0.75)" },
    ".Text": { color: "rgba(244, 241, 234, 0.55)" },
    ".ErrorText": { color: "#fca5a5", fontSize: "12px" },
    ".Input": {
      backgroundColor: "#161616",
      border: "1px solid rgba(244, 241, 234, 0.15)",
      borderRadius: "12px",
      padding: "11px 14px",
      boxShadow: "none",
    },
    ".Input:focus": {
      borderColor: "rgba(224, 176, 68, 0.6)",
      backgroundColor: "#1b1a18",
      boxShadow: "0 0 0 1.5px rgba(224, 176, 68, 0.35)",
    },
    ".Input--invalid": { borderColor: "rgba(248, 113, 113, 0.6)" },
    ".Input--invalid:focus": { boxShadow: "0 0 0 1.5px rgba(248, 113, 113, 0.35)" },
    ".Tab": {
      backgroundColor: "#161616",
      border: "1px solid rgba(244, 241, 234, 0.15)",
      color: "rgba(244, 241, 234, 0.6)",
      boxShadow: "none",
    },
    ".Tab:hover": { borderColor: "rgba(244, 241, 234, 0.3)" },
    ".Tab--selected": {
      borderColor: "rgba(224, 176, 68, 0.6)",
      backgroundColor: "#201c14",
      color: "#f4f1ea",
    },
    ".Block": {
      backgroundColor: "#1a1a1a",
      borderColor: "rgba(244, 241, 234, 0.1)",
      borderRadius: "14px",
    },
    ".Dropdown": {
      backgroundColor: "#161616",
      borderColor: "rgba(244, 241, 234, 0.15)",
      boxShadow: "0 12px 30px rgba(0, 0, 0, 0.45)",
    },
    ".DropdownItem": { color: "#f4f1ea" },
    ".DropdownItem:hover": { backgroundColor: "rgba(244, 241, 234, 0.06)" },
    ".DropdownItem--selected": { color: "#f4f1ea" },
    ".CheckboxInput": {
      backgroundColor: "#161616",
      borderColor: "rgba(244, 241, 234, 0.25)",
    },
    ".CheckboxInput:checked": { backgroundColor: "#e0b044", borderColor: "#e0b044" },
    ".Radio": { borderColor: "rgba(244, 241, 234, 0.25)" },
    ".RadioIcon": { backgroundColor: "#e0b044", borderColor: "#e0b044" },
    ".Separator": { backgroundColor: "rgba(244, 241, 234, 0.08)" },
    ".SectionDivider": { backgroundColor: "rgba(244, 241, 234, 0.08)" },
  },
}

/** Stripe's supported locale for the app's current language. */
export function stripeLocale(lng: string | undefined): StripeElementsOptions["locale"] {
  // Only Spanish opts into its own Stripe copy; everything else (including an
  // undefined language, i.e. before the document language is known) is English.
  return lng === "es" ? "es" : "en"
}
