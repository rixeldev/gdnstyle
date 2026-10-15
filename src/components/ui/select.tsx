"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"

import { Icon } from "@/components/ui/icon"
import { cn } from "@/utils/cn"

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  /** Accessible name; mirrors the visible (or sr-only) label around it. */
  ariaLabel: string
  id?: string
  disabled?: boolean
  /** Gold "off-default" state used by the filter toolbar. */
  active?: boolean
  /** Transparent pill for dense headers (language switcher). */
  variant?: "default" | "ghost"
  /** Popup alignment relative to the trigger. */
  align?: "left" | "right"
  /** Extra classes for the wrapper (e.g. `w-full` inside forms). */
  className?: string
  /** Extra classes for the trigger (e.g. `h-11 rounded-xl` inside forms). */
  triggerClassName?: string
}

/**
 * Themed select-only combobox — replaces every native `<select>` so the page
 * never shows the browser's own control or focus ring. The trigger is a pill
 * with a rotating chevron and a gold focus glow; the popup is the same
 * dark/gold listbox language as the search dropdowns, with the current value
 * checked. Full keyboard support: Enter/Space, arrows, Home/End, Escape, Tab.
 */
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  id,
  disabled = false,
  active = false,
  variant = "default",
  align = "left",
  className,
  triggerClassName,
}: SelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const selectedIndex = options.findIndex((option) => option.value === value)
  const current = selectedIndex >= 0 ? options[selectedIndex] : options[0]

  /** Close when clicking or tapping outside the control. */
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  function openMenu(at?: number) {
    setHighlight(at ?? (selectedIndex >= 0 ? selectedIndex : 0))
    setOpen(true)
  }

  function commit(index: number) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        openMenu()
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1)
      }
      return
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        setHighlight((index) => (index + 1) % options.length)
        break
      case "ArrowUp":
        event.preventDefault()
        setHighlight((index) => (index - 1 + options.length) % options.length)
        break
      case "Home":
        event.preventDefault()
        setHighlight(0)
        break
      case "End":
        event.preventDefault()
        setHighlight(options.length - 1)
        break
      case "Enter":
      case " ":
        event.preventDefault()
        commit(highlight)
        break
      case "Escape":
        event.preventDefault()
        setOpen(false)
        break
      case "Tab":
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex h-9 max-w-56 cursor-pointer items-center gap-2 rounded-full border py-1.5 pr-8 pl-3.5 text-xs font-medium transition",
          variant === "ghost"
            ? "text-cream/80 hover:border-cream/15 hover:bg-cream/5 hover:text-cream border-transparent bg-transparent"
            : "border-cream/15 bg-ink-card text-cream hover:border-gold/40 hover:bg-cream/5",
          active && "border-gold/60 bg-gold/10 text-gold hover:border-gold/70 hover:bg-gold/15",
          disabled && "hover:border-cream/15 cursor-not-allowed opacity-50 hover:bg-transparent",
          "focus-visible:border-gold/60 focus-visible:shadow-[0_0_0_3px_rgba(224,176,68,0.22)] focus-visible:outline-none",
          triggerClassName,
        )}
      >
        <span className="truncate">{current?.label ?? ""}</span>
      </button>
      <Icon
        name="chevron-down"
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 transition-transform",
          active ? "text-gold" : "text-cream/45",
          open && "rotate-180",
        )}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "border-cream/10 bg-ink-card/95 shadow-luxe animate-fade-in-up animate-duration-fast absolute top-full z-50 mt-2 max-h-64 w-max min-w-full overflow-y-auto rounded-2xl border p-1 backdrop-blur-md",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((option, index) => {
            const selected = option.value === value
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={selected}
                onClick={() => commit(index)}
                onMouseEnter={() => setHighlight(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition",
                  selected
                    ? "bg-gold/10 text-gold font-semibold"
                    : "text-cream/65 hover:bg-cream/5 hover:text-cream",
                  !selected && highlight === index && "bg-gold/5 text-cream",
                )}
              >
                <span className="truncate">{option.label}</span>
                {selected && <Icon name="check" className="size-3.5 shrink-0" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
