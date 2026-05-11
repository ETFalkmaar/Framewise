'use client';

import { useState, useTransition } from 'react';

import {
  createAvailabilityRule,
  updateAvailabilityRule,
  type CreateAvailabilityRuleInput,
} from '@/app/(i18n)/[locale]/(auth-required)/account/bookings/availability/actions';
import type { AvailabilityRule, DayOfWeek } from '@/types/database';

export interface AvailabilityRuleFormCopy {
  title: string;
  editTitle: string;
  name: string;
  namePlaceholder: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: string;
  slotDurationHint: string;
  maxPartySize: string;
  maxConcurrent: string;
  bufferMinutes: string;
  bufferHint: string;
  save: string;
  cancel: string;
  errorStartAfterEnd: string;
  errorGeneric: string;
  dayNames: string[]; // length 7, Sun..Sat
}

export interface AvailabilityRuleFormProps {
  /** When provided, the form opens in edit-mode pre-populated. */
  existing?: AvailabilityRule;
  /** When `existing` omitted, this seeds the new-rule's day-of-week. */
  defaultDayOfWeek?: DayOfWeek;
  onClose: () => void;
  copy: AvailabilityRuleFormCopy;
}

/**
 * Modal form for creating or editing an availability rule
 * (step 50). Hosts both flows behind a single client component so
 * the same UI handles "+ Nieuwe regel" and "Bewerken".
 */
export function AvailabilityRuleForm({
  existing,
  defaultDayOfWeek,
  onClose,
  copy,
}: AvailabilityRuleFormProps): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(existing?.name ?? '');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(
    existing?.day_of_week ?? defaultDayOfWeek ?? 1
  );
  const [startTime, setStartTime] = useState(existing?.start_time ?? '18:00');
  const [endTime, setEndTime] = useState(existing?.end_time ?? '22:00');
  const [slotDuration, setSlotDuration] = useState(existing?.slot_duration_minutes ?? 90);
  const [maxPartySize, setMaxPartySize] = useState(existing?.max_party_size ?? 6);
  const [maxConcurrent, setMaxConcurrent] = useState(existing?.max_concurrent_bookings ?? 8);
  const [bufferMinutes, setBufferMinutes] = useState(existing?.buffer_minutes ?? 15);

  function handleSubmit() {
    if (startTime >= endTime) {
      window.alert(copy.errorStartAfterEnd);
      return;
    }
    const payload: CreateAvailabilityRuleInput = {
      name: name.trim(),
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      slot_duration_minutes: slotDuration,
      max_party_size: maxPartySize,
      max_concurrent_bookings: maxConcurrent,
      buffer_minutes: bufferMinutes,
    };
    startTransition(async () => {
      const result = existing
        ? await updateAvailabilityRule({ ruleId: existing.id, patch: payload })
        : await createAvailabilityRule(payload);
      if (!result.success) {
        window.alert(copy.errorGeneric);
        return;
      }
      onClose();
    });
  }

  return (
    <div
      data-testid="rule-form"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border-border w-full max-w-lg space-y-3 rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{existing ? copy.editTitle : copy.title}</h2>

        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.name}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={copy.namePlaceholder}
            data-testid="rule-form-name"
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.dayOfWeek}</span>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value) as DayOfWeek)}
            data-testid="rule-form-day"
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            {copy.dayNames.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-muted-foreground text-xs">{copy.startTime}</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              data-testid="rule-form-start"
              className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground text-xs">{copy.endTime}</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              data-testid="rule-form-end"
              className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-muted-foreground text-xs">{copy.slotDuration}</span>
          <input
            type="number"
            min={15}
            value={slotDuration}
            onChange={(e) => setSlotDuration(Number(e.target.value))}
            data-testid="rule-form-duration"
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
          <span className="text-muted-foreground mt-1 block text-[10px]">
            {copy.slotDurationHint}
          </span>
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-muted-foreground text-xs">{copy.maxPartySize}</span>
            <input
              type="number"
              min={1}
              value={maxPartySize}
              onChange={(e) => setMaxPartySize(Number(e.target.value))}
              data-testid="rule-form-party"
              className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground text-xs">{copy.maxConcurrent}</span>
            <input
              type="number"
              min={1}
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Number(e.target.value))}
              data-testid="rule-form-concurrent"
              className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground text-xs">{copy.bufferMinutes}</span>
            <input
              type="number"
              min={0}
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value))}
              data-testid="rule-form-buffer"
              className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
        </div>

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
            disabled={pending}
            data-testid="rule-form-submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}
