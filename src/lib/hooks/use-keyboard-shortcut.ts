'use client';

import { useEffect } from 'react';

/**
 * Bind a single global keyboard shortcut to a callback. Built
 * for the admin Cmd+K / Ctrl+K opener in step 38, but generic
 * enough for any future global hotkey.
 *
 * The `key` argument is the lower-cased keyboard `event.key`
 * (e.g. `'k'`, `'/'`). When `meta: true` the shortcut requires
 * the platform meta key — Cmd on macOS, Ctrl elsewhere. Editing
 * targets (inputs / textareas / contenteditable elements) are
 * skipped so a stray `/` or `k` in a field doesn't open a
 * modal.
 */
export interface KeyboardShortcutOptions {
  meta?: boolean;
  shift?: boolean;
  /** When `false` the hotkey still fires inside form fields. Default: `true`. */
  ignoreInputs?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: KeyboardShortcutOptions = {}
): void {
  const { meta = false, shift = false, ignoreInputs = true } = options;

  useEffect(() => {
    function handler(event: KeyboardEvent): void {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (meta && !(event.metaKey || event.ctrlKey)) return;
      if (!meta && (event.metaKey || event.ctrlKey)) return;
      if (shift !== event.shiftKey) return;
      if (ignoreInputs && isEditingTarget(event.target)) return;
      event.preventDefault();
      callback();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, meta, shift, ignoreInputs]);
}

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}
