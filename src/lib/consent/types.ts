/**
 * GDPR cookie consent types and constants (step 28).
 *
 * Three categories: `necessary` (always on, cannot be opted out of —
 * session cookies, CSRF tokens, security gates), `analytics` (page
 * views, performance tracking), and `marketing` (remarketing pixels,
 * personalised ads). Default is *deny* for analytics + marketing
 * until the visitor opts in — pre-checked boxes are forbidden under
 * GDPR.
 *
 * The consent record is stored under `framewise_consent_v1` in
 * `localStorage`. Bumping `CONSENT_VERSION` invalidates every
 * stored record so visitors get the banner again — useful when we
 * add a fourth category or rename one.
 */

export const CONSENT_VERSION = 1 as const;
export const CONSENT_STORAGE_KEY = 'framewise_consent_v1' as const;
/** A consent record older than this many days is treated as expired. */
export const CONSENT_TTL_DAYS = 365;
/** Custom DOM event dispatched on `window` when the consent record changes. */
export const CONSENT_CHANGED_EVENT = 'framewise:consent-changed';

export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

/**
 * The three booleans the rest of the app reacts to. `necessary` is
 * a literal `true` — there's no way to disable it, and code that
 * gates on it can rely on the type.
 */
export interface ConsentChoices {
  readonly necessary: true;
  readonly analytics: boolean;
  readonly marketing: boolean;
}

/** What goes into `localStorage` — choices plus an audit trail. */
export interface ConsentRecord {
  readonly version: number;
  readonly choices: ConsentChoices;
  readonly timestamp: string;
  readonly userAgent?: string;
}

/** Initial state before the user opts in. */
export const DEFAULT_DENY: ConsentChoices = {
  necessary: true,
  analytics: false,
  marketing: false,
};

/** What "Accept all" sets. */
export const ACCEPT_ALL: ConsentChoices = {
  necessary: true,
  analytics: true,
  marketing: true,
};
