/**
 * Module-level cache of `POST /session` results so we don't hammer
 * e-Boekhouden with a fresh session on every request.
 *
 * Lifetime is 55 minutes — 5 minutes shy of the documented 60-minute
 * expiry, leaving a safety margin for clock skew + in-flight calls.
 *
 * Reset semantics: the cache is plain-object module state. It clears
 * on every cold start (deploy, lambda recycle, vitest worker exit).
 * That's intentional — we never want a session token to outlive the
 * process that minted it.
 */

interface CachedSession {
  token: string;
  /** Epoch ms when the cache entry should be discarded (55min < real expiry). */
  expiresAt: number;
}

const SAFETY_MARGIN_MS = 5 * 60 * 1000;

const cache = new Map<string, CachedSession>();

/**
 * Lookup a cached session. Returns the token when still valid, or
 * `null` when missing / expired. `null` is the caller's signal to
 * `startSession()` again.
 */
export function getCachedSession(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.token;
}

/**
 * Persist a session token. `expires` is the ISO datetime returned by
 * the provider; we subtract `SAFETY_MARGIN_MS` so callers see the
 * cache expire before the upstream token does.
 */
export function setCachedSession(key: string, token: string, expires: string): void {
  const expiresAtRaw = Date.parse(expires);
  if (!Number.isFinite(expiresAtRaw)) {
    // Defensive: if the provider sends garbage, don't poison the cache.
    cache.delete(key);
    return;
  }
  cache.set(key, {
    token,
    expiresAt: expiresAtRaw - SAFETY_MARGIN_MS,
  });
}

/**
 * Drop a cached entry. Called by the client after a 401 retry so the
 * next request mints a fresh session instead of looping on the dead
 * one.
 */
export function invalidateCachedSession(key: string): void {
  cache.delete(key);
}

/** Test seam — used by vitest cases to start from a known-empty cache. */
export function __resetSessionCache(): void {
  cache.clear();
}

/** Test seam — read the raw entry, not the validity-checked token. */
export function __peekCachedSession(key: string): CachedSession | undefined {
  return cache.get(key);
}
