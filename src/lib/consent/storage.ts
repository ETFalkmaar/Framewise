import {
  ACCEPT_ALL,
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  CONSENT_TTL_DAYS,
  CONSENT_VERSION,
  DEFAULT_DENY,
  type ConsentChoices,
  type ConsentRecord,
} from './types';

/**
 * Read the stored consent record (step 28).
 *
 * Returns `null` when:
 *  - we're running in an SSR context (no `window`)
 *  - the key is absent
 *  - the value isn't valid JSON
 *  - the record's `version` doesn't match `CONSENT_VERSION`
 *  - the record is older than `CONSENT_TTL_DAYS`
 *  - the choices don't have the expected shape (`necessary !== true`,
 *    boolean fields missing, etc.)
 *
 * The function never throws — corrupt or stale records are treated
 * as "no consent given yet" so the visitor sees the banner again.
 */
export function readConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;
  const storage = safeLocalStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isConsentRecordShape(parsed)) return null;
  if (parsed.version !== CONSENT_VERSION) return null;
  if (isExpired(parsed.timestamp)) return null;

  return parsed;
}

/**
 * Persist the user's consent choices and dispatch
 * `CONSENT_CHANGED_EVENT` on `window` so listeners (the
 * provider, third-party loaders, etc.) can react. Returns the
 * full record we wrote so callers don't need to reconstruct it.
 *
 * Forces `necessary: true` regardless of what the caller passes —
 * the type already enforces this but defence in depth never hurts.
 */
export function writeConsent(choices: ConsentChoices): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    choices: { ...choices, necessary: true },
    timestamp: new Date().toISOString(),
    ...(typeof navigator !== 'undefined' && navigator.userAgent
      ? { userAgent: navigator.userAgent }
      : {}),
  };

  if (typeof window === 'undefined') return record;
  const storage = safeLocalStorage();
  if (!storage) return record;

  try {
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    return record;
  }

  dispatchConsentChanged();
  return record;
}

/**
 * Drop the stored record and dispatch the event so listeners can
 * fall back to defaults. Used by tests and (future) "withdraw
 * consent" flows.
 */
export function clearConsent(): void {
  if (typeof window === 'undefined') return;
  const storage = safeLocalStorage();
  if (!storage) return;

  try {
    storage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    return;
  }
  dispatchConsentChanged();
}

/** Convenience: did the visitor make a choice that's still valid? */
export function hasGivenConsent(): boolean {
  return readConsent() !== null;
}

/**
 * Helper used by the provider to bootstrap state — falls back to
 * `DEFAULT_DENY` when nothing's stored.
 */
export function getCurrentChoices(): ConsentChoices {
  return readConsent()?.choices ?? DEFAULT_DENY;
}

export { ACCEPT_ALL, DEFAULT_DENY };

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dispatchConsentChanged(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  } catch {
    // happens in odd JSDOM corners; silently ignore
  }
}

function isConsentRecordShape(value: unknown): value is ConsentRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ConsentRecord> & Record<string, unknown>;
  if (typeof v.version !== 'number') return false;
  if (typeof v.timestamp !== 'string') return false;
  const choices = v.choices;
  if (!choices || typeof choices !== 'object') return false;
  const c = choices as unknown as Record<string, unknown>;
  if (c.necessary !== true) return false;
  if (typeof c.analytics !== 'boolean') return false;
  if (typeof c.marketing !== 'boolean') return false;
  return true;
}

function isExpired(timestamp: string): boolean {
  const recorded = Date.parse(timestamp);
  if (Number.isNaN(recorded)) return true;
  const ageMs = Date.now() - recorded;
  return ageMs > CONSENT_TTL_DAYS * 24 * 60 * 60 * 1000;
}
