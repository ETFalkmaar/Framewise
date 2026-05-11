'use client';

import { useState, useTransition } from 'react';

import {
  AvailabilityRuleForm,
  type AvailabilityRuleFormCopy,
} from '@/components/bookings/availability-rule-form';
import {
  BookingExceptionForm,
  type BookingExceptionFormCopy,
} from '@/components/bookings/booking-exception-form';
import {
  deleteAvailabilityRule,
  deleteBookingException,
  toggleAvailabilityRule,
} from '@/app/(i18n)/[locale]/(auth-required)/account/bookings/availability/actions';
import type { AvailabilityRule, BookingException, DayOfWeek } from '@/types/database';

export interface AvailabilityPageClientCopy {
  addRule: string;
  addException: string;
  rulesEmpty: string;
  exceptionsEmpty: string;
  activeLabel: string;
  inactiveLabel: string;
  durationFmt: string; // "{minutes} min slots"
  capacityFmt: string; // "Max {count} gelijktijdige boekingen"
  partyFmt: string; // "Max {count} personen"
  bufferFmt: string; // "{minutes} min buffer"
  edit: string;
  deleteLabel: string;
  deactivate: string;
  activate: string;
  deleteConfirm: string;
  errorGeneric: string;
  closedBadge: string;
  customTimesFmt: string; // "{start} - {end}"
  dayNames: string[];
  ruleFormCopy: AvailabilityRuleFormCopy;
  exceptionFormCopy: BookingExceptionFormCopy;
}

export interface AvailabilityPageClientProps {
  rules: AvailabilityRule[];
  exceptions: BookingException[];
  copy: AvailabilityPageClientCopy;
}

/**
 * Client wrapper that handles the modal state for both forms
 * (rule + exception) and the inline mutations (toggle, delete).
 * Receives already-fetched server data so the page stays fast
 * for users with lots of rules.
 */
export function AvailabilityPageClient({
  rules,
  exceptions,
  copy,
}: AvailabilityPageClientProps): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [ruleForm, setRuleForm] = useState<{
    open: boolean;
    existing?: AvailabilityRule;
    defaultDay?: DayOfWeek;
  }>({ open: false });
  const [exceptionFormOpen, setExceptionFormOpen] = useState(false);

  const rulesByDay = new Map<DayOfWeek, AvailabilityRule[]>();
  for (const r of rules) {
    const arr = rulesByDay.get(r.day_of_week) ?? [];
    arr.push(r);
    rulesByDay.set(r.day_of_week, arr);
  }

  function handleToggle(rule: AvailabilityRule) {
    startTransition(async () => {
      const r = await toggleAvailabilityRule({ ruleId: rule.id });
      if (!r.success) window.alert(copy.errorGeneric);
    });
  }

  function handleDeleteRule(rule: AvailabilityRule) {
    if (!window.confirm(copy.deleteConfirm)) return;
    startTransition(async () => {
      const r = await deleteAvailabilityRule({ ruleId: rule.id });
      if (!r.success) window.alert(copy.errorGeneric);
    });
  }

  function handleDeleteException(ex: BookingException) {
    if (!window.confirm(copy.deleteConfirm)) return;
    startTransition(async () => {
      const r = await deleteBookingException({ exceptionId: ex.id });
      if (!r.success) window.alert(copy.errorGeneric);
    });
  }

  return (
    <div className="space-y-8" data-testid="availability-page">
      {/* Weekly rules grouped per day */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{/* server-rendered title above */}</h2>
          <button
            type="button"
            onClick={() => setRuleForm({ open: true })}
            data-testid="add-rule-button"
            className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
          >
            + {copy.addRule}
          </button>
        </div>

        {rules.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{copy.rulesEmpty}</p>
        ) : (
          <div className="grid gap-3">
            {([1, 2, 3, 4, 5, 6, 0] as DayOfWeek[]).map((day) => {
              const dayRules = rulesByDay.get(day) ?? [];
              if (dayRules.length === 0) return null;
              return (
                <div key={day} className="border-border rounded-md border p-3">
                  <h3 className="mb-2 text-sm font-semibold">{copy.dayNames[day]}</h3>
                  <ul className="grid gap-2">
                    {dayRules.map((rule) => (
                      <li
                        key={rule.id}
                        data-testid={`rule-card-${rule.id}`}
                        className={`border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm ${rule.is_active ? '' : 'opacity-60'}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{rule.name}</span>
                            <span
                              data-testid={`rule-${rule.id}-active-${rule.is_active}`}
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                                rule.is_active
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              {rule.is_active ? copy.activeLabel : copy.inactiveLabel}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1 font-mono text-xs">
                            {rule.start_time}–{rule.end_time} ·{' '}
                            {copy.durationFmt.replace(
                              '{minutes}',
                              String(rule.slot_duration_minutes)
                            )}
                            {' · '}
                            {copy.capacityFmt.replace(
                              '{count}',
                              String(rule.max_concurrent_bookings)
                            )}
                            {' · '}
                            {copy.partyFmt.replace('{count}', String(rule.max_party_size))}
                            {rule.buffer_minutes > 0
                              ? ` · ${copy.bufferFmt.replace('{minutes}', String(rule.buffer_minutes))}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setRuleForm({ open: true, existing: rule })}
                            data-testid={`rule-edit-${rule.id}`}
                            className="ring-border bg-background hover:bg-muted rounded-md px-2 py-1 font-mono text-[10px] ring-1"
                          >
                            {copy.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(rule)}
                            disabled={pending}
                            data-testid={`rule-toggle-${rule.id}`}
                            className="ring-border bg-background hover:bg-muted rounded-md px-2 py-1 font-mono text-[10px] ring-1 disabled:opacity-50"
                          >
                            {rule.is_active ? copy.deactivate : copy.activate}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule)}
                            disabled={pending}
                            data-testid={`rule-delete-${rule.id}`}
                            className="ring-destructive/40 text-destructive hover:bg-destructive/10 rounded-md px-2 py-1 font-mono text-[10px] ring-1 disabled:opacity-50"
                          >
                            {copy.deleteLabel}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Exceptions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{/* server title */}</h2>
          <button
            type="button"
            onClick={() => setExceptionFormOpen(true)}
            data-testid="add-exception-button"
            className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
          >
            + {copy.addException}
          </button>
        </div>

        {exceptions.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{copy.exceptionsEmpty}</p>
        ) : (
          <ul className="grid gap-2">
            {exceptions.map((ex) => (
              <li
                key={ex.id}
                data-testid={`exception-card-${ex.id}`}
                className="border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{ex.date}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                        ex.is_closed
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {ex.is_closed
                        ? copy.closedBadge
                        : copy.customTimesFmt
                            .replace('{start}', ex.custom_start_time ?? '')
                            .replace('{end}', ex.custom_end_time ?? '')}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">{ex.reason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteException(ex)}
                  disabled={pending}
                  data-testid={`exception-delete-${ex.id}`}
                  className="ring-destructive/40 text-destructive hover:bg-destructive/10 rounded-md px-2 py-1 font-mono text-[10px] ring-1 disabled:opacity-50"
                >
                  {copy.deleteLabel}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ruleForm.open && (
        <AvailabilityRuleForm
          existing={ruleForm.existing}
          defaultDayOfWeek={ruleForm.defaultDay}
          onClose={() => setRuleForm({ open: false })}
          copy={copy.ruleFormCopy}
        />
      )}

      {exceptionFormOpen && (
        <BookingExceptionForm
          onClose={() => setExceptionFormOpen(false)}
          copy={copy.exceptionFormCopy}
        />
      )}
    </div>
  );
}
