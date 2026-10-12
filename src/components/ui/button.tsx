"use client"

import Link, { type LinkProps } from "next/link"
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"

import { cn } from "@/utils/cn"

import { Spinner } from "./spinner"

export type ButtonVariant = "primary" | "outline" | "ghost" | "subtle" | "link" | "danger"
export type ButtonSize = "sm" | "md" | "lg"

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-55"

const variants: Record<ButtonVariant, string> = {
  primary: "btn-shine bg-gold text-gold-ink hover:bg-gold-soft",
  outline: "border border-cream/20 text-cream hover:border-cream/50 hover:bg-cream/5",
  ghost: "text-cream/70 hover:bg-cream/5 hover:text-cream",
  subtle: "border border-cream/10 bg-cream/5 text-cream hover:border-gold/40",
  link: "rounded-none p-0 text-gold underline-offset-4 hover:underline",
  danger: "bg-red-500 text-white hover:bg-red-400",
}

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-7 text-base",
}

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(base, variants[variant], variant === "link" ? "" : sizes[size], className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    iconLeft,
    iconRight,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  )
})

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  iconLeft,
  iconRight,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  )
}
