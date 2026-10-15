"use client"

import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"

export interface ConfirmDialogProps {
  open: boolean
  title: string
  body?: ReactNode
  /** Extra controls (a reason field, a checkbox…) shown above the actions. */
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` styles the confirm action for destructive operations. */
  tone?: "default" | "danger"
  loading?: boolean
  /** Keeps the confirm action unreachable while a required field is empty. */
  confirmDisabled?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Reusable confirmation modal built on the shared `Modal`. Every destructive
 * action (cancel an appointment, remove a favorite, …) goes through it so the
 * visitor always gets an explicit, accessible confirmation step.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  children,
  confirmLabel,
  cancelLabel,
  tone = "default",
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <div className="p-5">
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {body && <p className="text-cream/60 mt-2 text-sm leading-relaxed">{body}</p>}
        {children && <div className="mt-4">{children}</div>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel ?? t("common.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
