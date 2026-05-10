import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { FlowState } from '../types';

/** HTTP-only cookie that holds the signed `FlowState` for an in-flight OAuth round-trip. */
export const OAUTH_FLOW_COOKIE = 'framewise_oauth_flow';

/** Default flow-state TTL — long enough for a slow OAuth provider, short enough that stale state is harmless. */
export const FLOW_STATE_TTL_MS = 10 * 60 * 1000;

const DEV_FALLBACK_SECRET = 'framewise-mock-flow-secret-do-not-use-in-prod-please-change-me';

/**
 * The cookie is signed with the same secret used by `iron-session`.
 * In dev / preview the fallback keeps the framework working without
 * an env var; the runtime check in `auth/session.ts` already guards
 * `VERCEL_ENV === 'production'`, so the fallback never reaches a real
 * production deploy.
 */
function getSecret(): string {
  const fromEnv = process.env.SESSION_PASSWORD;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  return DEV_FALLBACK_SECRET;
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url');
}

/**
 * Pack a `FlowState` into a `<base64url-payload>.<hmac>` string that
 * survives a round-trip through a Set-Cookie header.
 */
export function packFlowState(payload: FlowState): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json, 'utf8').toString('base64url');
  return `${data}.${sign(data)}`;
}

/**
 * Verify the signature, parse the payload, and check the expiry.
 * Returns `null` for any failure mode — callers throw a uniform
 * `StateValidationError` so the UI doesn't leak which sub-check failed.
 */
export function unpackFlowState(token: string | undefined | null): FlowState | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(data);
  if (!constantTimeEqual(sig, expected)) return null;

  let payload: FlowState;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  return payload;
}

/**
 * Constant-time string compare. Length mismatch is itself a leak so
 * we equalise lengths before the timing-safe comparison.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  return timingSafeEqual(aBuf, bBuf);
}

/** 32 random bytes hex-encoded — used as the OAuth `state` query param. */
export function generateState(): string {
  return randomBytes(32).toString('hex');
}

/** Generate a PKCE pair: 43-char verifier + S256 challenge. */
export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}
