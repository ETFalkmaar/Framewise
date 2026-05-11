'use client';

import { useState, useTransition } from 'react';

import { createBookingException } from '@/app/(i18n)/[locale]/(auth-required)/account/bookings/availability/actions';

export interface BookingExceptionFormCopy {
  title: string;
  date: string;
  reason: string;
  reasonPlaceholder: string;
  isClosed: string;
  isClosedHint: string;
  customStartTime: string;
  customEndTime: string;
  save: string;
  cancel: string;
  errorGeneric: string;
}

export interface BookingExceptionFormProps {
  /** Defaulting to "today + 7" gives the customer a sensible starting point. */
  defaultDate?: string;
  onClose: () => void;
  copy: BookingExceptionFormCopy;
}

/**
 * Modal form for adding a `BookingException` (step 50). Two modes
 * driven by the `is_closed` checkbox:
 *
 *  - `is_closed: true` → date + reason only; the closed-state in the
 *    DB is what the slot generator checks against.
 *  - `is_closed: false` → customer wants different hours that day;
 *    custom_start_time + custom_end_time become required.
 */
export function BookingExceptionForm({
  defaultDate,
  onClose,
  copy,
}: BookingExceptionFormProps): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultDate ?? '');
  const [reason, setReason] = useState('');
  const [isClosed, setIsClosed] = useState(true);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('22:00');

  function handleSubmit() {
    if (!date || !reason.trim()) return;
    startTransition(async () => {
      const result = await createBookingException({
        date,
        reason: reason.trim(),
        is_closed: isClosed,
        custom_start_time: isClosed ? undefined : startTime,
        custom_end_time: isClosed ? undefined : endTime,
      });
      if (!result.success) {
        window.alert(copy.errorGeneric);
        return;
      }
      onClose();
    });
  }

  return (
    <div
      data-testid="exception-form"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border-border w-full max-w-md space-y-3 rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{copy.title}</h2>

        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.date}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="exception-date"
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.reason}</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={copy.reasonPlaceholder}
            data-testid="exception-reason"
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={isClosed}
            onChange={(e) => setIsClosed(e.target.checked)}
            data-testid="exception-closed-checkbox"
            className="mt-1"
          />
          <span>
            <span className="font-medium">{copy.isClosed}</span>
            <span className="text-muted-foreground mt-0.5 block text-xs">{copy.isClosedHint}</span>
          </span>
        </label>

        {!isClosed && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-muted-foreground text-xs">{copy.customStartTime}</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="exception-start"
                className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground text-xs">{copy.customEndTime}</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-testid="exception-end"
                className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="ring-border bg-background hover:bg-muted rounded-md px-4 py-2 text-sm ring-1"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !date || !reason.trim()}
            data-testid="exception-submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}
