import { twMerge } from "tailwind-merge"

export type ClassValue = string | number | false | null | undefined

/** Join conditional class names and de-duplicate conflicting Tailwind classes. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(classes.filter(Boolean).join(" "))
}
