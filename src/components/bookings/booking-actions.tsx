'use client';

import { useTransition } from 'react';

import {
  cancelBookingAction,
  confirmBookingAction,
  markNoShowAction,
} from '@/app/(i18n)/[locale]/(auth-required)/account/bookings/actions';
import type { BookingStatus } from '@/types/database';

export interface BookingActionsCopy {
  confirm: string;
  cancel: string;
  cancelReason: string;
  cancelConfirm: string;
  markNoShow: string;
  markNoShowConfirm: string;
  errorGeneric: string;
}

export interface BookingActionsProps {
  bookingId: string;
  status: BookingStatus;
  copy: BookingActionsCopy;
}

/**
 * Action row on the day-detail booking card (step 49). Shows
 * different buttons depending on current status:
 *  - pending: Confirm + Cancel
 *  - confirmed: Cancel + Mark no-show
 *  - cancelled / completed / no_show: no actions (terminal)
 *
 * Uses window.prompt for the cancel-reason input — the spec doesn't
 * require a full modal here, and the prompt keeps the surface tiny.
 */
export function BookingActions({
  bookingId,
  status,
  copy,
}: BookingActionsProps): React.ReactElement | null {
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmBookingAction({ bookingId });
      if (!result.success) window.alert(copy.errorGeneric);
    });
  }

  function handleCancel() {
    if (!window.confirm(copy.cancelConfirm)) return;
    const reason = window.prompt(copy.cancelReason) ?? undefined;
    startTransition(async () => {
      const result = await cancelBookingAction({ bookingId, reason });
      if (!result.success) window.alert(copy.errorGeneric);
    });
  }

  function handleNoShow() {
    if (!window.confirm(copy.markNoShowConfirm)) return;
    startTransition(async () => {
      const result = await markNoShowAction({ bookingId });
      if (!result.success) window.alert(copy.errorGeneric);
    });
  }

  const canConfirm = status === 'pending';
  const canCancel = status === 'pending' || status === 'confirmed';
  const canMarkNoShow = status === 'confirmed';

  if (!canConfirm && !canCancel && !canMarkNoShow) return null;

  return (
    <div data-testid="booking-actions" className="mt-4 flex flex-wrap gap-2">
      {canConfirm && (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          data-testid="booking-confirm"
          className="rounded-md bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {copy.confirm}
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          data-testid="booking-cancel"
          className="ring-destructive/40 text-destructive hover:bg-destructive/10 rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition disabled:opacity-50"
        >
          {copy.cancel}
        </button>
      )}
      {canMarkNoShow && (
        <button
          type="button"
          onClick={handleNoShow}
          disabled={pending}
          data-testid="booking-no-show"
          className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition disabled:opacity-50"
        >
          {copy.markNoShow}
        </button>
      )}
    </div>
  );
}
