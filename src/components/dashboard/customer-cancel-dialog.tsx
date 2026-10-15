"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Icon } from "@/components/ui/icon"
import { TextArea } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import { type Booking } from "@/hooks/use-bookings"
import { type CancellationOutcome } from "@/services/appointments.service"
import { parseDateKey } from "@/utils/date"
import { formatDate, toIntlLocale } from "@/utils/format"

interface CustomerCancelDialogProps {
  /** The booking being cancelled, or `null` while the dialog is closed. */
  booking: Booking | null
  cancel: (id: string, reason: string) => Promise<CancellationOutcome>
  onClose: () => void
}

/**
 * Cancellation prompt for the client side, shared by the appointment list and
 * the "next appointment" card so both behave identically.
 *
 * The reason is mandatory: it is stored on the row and the professional reads
 * it on their dashboard, which is the only way a refusal is ever explained.
 */
export function CustomerCancelDialog({ booking, cancel, onClose }: CustomerCancelDialogProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.language)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  // Reset when the booking changes, adjusting state during render instead of
  // in an effect: React's documented pattern for "the prop changed, the form
  // starts clean", and it avoids a second render pass per dialog open.
  const [openFor, setOpenFor] = useState<string | null>(null)
  if (booking?.id !== openFor) {
    setOpenFor(booking?.id ?? null)
    setReason("")
  }

  async function handleConfirm() {
    if (!booking || !reason.trim()) return
    const id = booking.id
    const text = reason.trim()
    setBusy(true)
    const outcome = await cancel(id, text)
    setBusy(false)
    onClose()

    if (outcome === "refund-requested") toast(t("dashboard.customer.cancelRefundRequested"))
    else if (outcome === "cancelled") toast(t("dashboard.customer.cancelled"))
    // Raced the 1h30m window while the dialog was open.
    else if (outcome === "too-late") toast(t("dashboard.customer.changesLockedToast"), "neutral")
    else toast(t("common.tryAgain"), "neutral")
  }

  return (
    <ConfirmDialog
      open={booking !== null}
      title={t("dashboard.customer.cancelConfirmTitle")}
      body={
        booking
          ? `${t("dashboard.customer.cancelConfirmBody", {
              service: booking.serviceName ?? t(`venues.services.${booking.serviceId}`),
              date: formatDate(parseDateKey(booking.date), locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
              }),
            })} ${
              booking.paymentStatus &&
              booking.paymentStatus !== "none" &&
              booking.paymentStatus !== "refunded"
                ? t("dashboard.customer.cancelRefundNote")
                : ""
            }`
          : undefined
      }
      confirmLabel={t("dashboard.customer.cancelConfirm")}
      cancelLabel={t("dashboard.customer.cancelKeep")}
      tone="danger"
      loading={busy}
      confirmDisabled={!reason.trim()}
      onConfirm={handleConfirm}
      onClose={onClose}
    >
      <TextArea
        label={t("dashboard.customer.cancelReasonLabel")}
        hint={t("dashboard.customer.cancelReasonHint")}
        placeholder={t("dashboard.customer.cancelReasonPlaceholder")}
        rows={3}
        maxLength={300}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </ConfirmDialog>
  )
}

/** Shared action row: edit while the window is open, cancel always asking why. */
export function BookingRowActions({
  canModify,
  onEdit,
  onCancel,
}: {
  canModify: boolean
  onEdit: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onEdit}
        disabled={!canModify}
        iconLeft={<Icon name="calendar" className="size-4" />}
      >
        {t("dashboard.customer.edit")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={!canModify}
        iconLeft={<Icon name="trash" className="size-4" />}
      >
        {t("dashboard.customer.cancel")}
      </Button>
    </span>
  )
}
