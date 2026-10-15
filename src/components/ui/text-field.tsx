"use client"

import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react"

import { cn } from "@/utils/cn"

import { Icon } from "./icon"

const inputClasses =
  "h-11 w-full rounded-xl border bg-cream/3 px-3.5 text-sm text-cream placeholder:text-cream/35 outline-none transition focus:border-gold/60 focus:bg-cream/5 disabled:opacity-60"

interface FieldChromeProps {
  id: string
  label: ReactNode
  error?: string
  hint?: string
  errorId: string
  hintId: string
  children: ReactNode
  required?: boolean
}

function FieldChrome({
  id,
  label,
  error,
  hint,
  errorId,
  hintId,
  children,
  required,
}: FieldChromeProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-cream/80 block text-sm font-medium">
        {label}
        {required && (
          <span className="text-gold ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-cream/45 text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs font-medium text-red-300">
          <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  error?: string
  hint?: string
}

export function TextField({
  label,
  error,
  hint,
  id,
  className,
  required,
  ...props
}: TextFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  return (
    <FieldChrome
      id={fieldId}
      label={label}
      error={error}
      hint={hint}
      errorId={errorId}
      hintId={hintId}
      required={required}
    >
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && !error && hintId) || undefined}
        className={cn(inputClasses, error ? "border-red-400/60" : "border-cream/15", className)}
        required={required}
        {...props}
      />
    </FieldChrome>
  )
}

interface PasswordFieldProps extends Omit<TextFieldProps, "type"> {
  showLabel: string
  hideLabel: string
}

export function PasswordField({
  label,
  error,
  hint,
  id,
  className,
  required,
  showLabel,
  hideLabel,
  ...props
}: PasswordFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  const [visible, setVisible] = useState(false)

  return (
    <FieldChrome
      id={fieldId}
      label={label}
      error={error}
      hint={hint}
      errorId={errorId}
      hintId={hintId}
      required={required}
    >
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(error && errorId, hint && !error && hintId) || undefined}
          className={cn(
            inputClasses,
            "pr-11",
            error ? "border-red-400/60" : "border-cream/15",
            className,
          )}
          required={required}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="text-cream/50 hover:text-cream absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl transition"
        >
          <Icon name={visible ? "eye-off" : "eye"} className="h-[1.15rem] w-[1.15rem]" />
        </button>
      </div>
    </FieldChrome>
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode
  error?: string
  hint?: string
}

/** Multi-line counterpart of `TextField` sharing the same field chrome. */
export function TextArea({ label, error, hint, id, className, required, ...props }: TextAreaProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  return (
    <FieldChrome
      id={fieldId}
      label={label}
      error={error}
      hint={hint}
      errorId={errorId}
      hintId={hintId}
      required={required}
    >
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && !error && hintId) || undefined}
        className={cn(
          inputClasses,
          "h-auto min-h-24 resize-none py-2.5 leading-relaxed",
          error ? "border-red-400/60" : "border-cream/15",
          className,
        )}
        required={required}
        {...props}
      />
    </FieldChrome>
  )
}
