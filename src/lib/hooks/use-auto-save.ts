'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Auto-save hook (step 46 — fase 12 part 8/8). Wraps any value
 * in a debounced "save when it stops changing" loop with public
 * status state so the form can render an indicator.
 *
 * Status lifecycle:
 *  idle → saving → saved (2s) → idle
 *                  ↓
 *                  conflict (sticky until caller resets)
 *                  error (sticky until next successful save)
 *
 * The hook deliberately doesn't own conflict resolution — when
 * `onSave` returns `{ conflict: true }`, status flips to
 * `'conflict'` and the caller is expected to render a dialog +
 * call `resetStatus()` after the user picks reload vs overwrite.
 *
 * `manualSave` bypasses the debounce, useful for an explicit
 * Save button that fires immediately. Both `manualSave` and the
 * debounced path skip work when `value === lastSavedValue` so a
 * Save click right after auto-save doesn't double-save.
 */
export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface AutoSaveResult {
  success: boolean;
  conflict?: boolean;
  error?: string;
}

export interface UseAutoSaveOptions<T> {
  value: T;
  onSave: (value: T) => Promise<AutoSaveResult>;
  /** Debounce in ms. Default 30000 (30s) to match the spec. */
  delay?: number;
  enabled?: boolean;
  /**
   * Optional equality check — when omitted we compare via JSON
   * stringify which is fine for the block-form payloads (small +
   * stable key order). Callers with non-serialisable shapes can
   * pass their own predicate.
   */
  equals?: (a: T, b: T) => boolean;
}

export interface UseAutoSaveReturn {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  /** Bypass the debounce and save right now. No-op if unchanged. */
  manualSave: () => Promise<void>;
  /** Clear `'saved'`, `'conflict'` or `'error'` back to `'idle'`. */
  resetStatus: () => void;
  /** Last error message — populated when status === 'error'. */
  errorMessage: string | null;
}

const DEFAULT_DELAY_MS = 30_000;
const SAVED_FLASH_MS = 2_000;

function defaultEquals<T>(a: T, b: T): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function useAutoSave<T>({
  value,
  onSave,
  delay = DEFAULT_DELAY_MS,
  enabled = true,
  equals = defaultEquals,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs hold the latest closures so the timer keeps working
  // across renders without re-arming on every keystroke.
  const lastSavedValueRef = useRef<T>(value);
  const onSaveRef = useRef(onSave);
  const equalsRef = useRef(equals);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    equalsRef.current = equals;
  }, [equals]);

  const doSave = useCallback(async (next: T): Promise<void> => {
    if (equalsRef.current(next, lastSavedValueRef.current)) return;

    setStatus('saving');
    setErrorMessage(null);
    try {
      const result = await onSaveRef.current(next);
      if (result.conflict) {
        setStatus('conflict');
        return;
      }
      if (!result.success) {
        setStatus('error');
        setErrorMessage(result.error ?? null);
        return;
      }
      lastSavedValueRef.current = next;
      setLastSavedAt(new Date());
      setStatus('saved');
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setStatus('idle');
        flashTimerRef.current = null;
      }, SAVED_FLASH_MS);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Debounced auto-save loop.
  useEffect(() => {
    if (!enabled) return;
    if (status === 'conflict') return; // wait for the dialog to resolve
    if (equalsRef.current(value, lastSavedValueRef.current)) return;

    const timer = setTimeout(() => {
      void doSave(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, enabled, delay, doSave, status]);

  // Final cleanup on unmount.
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const manualSave = useCallback(async () => {
    await doSave(value);
  }, [doSave, value]);

  const resetStatus = useCallback(() => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { status, lastSavedAt, manualSave, resetStatus, errorMessage };
}
