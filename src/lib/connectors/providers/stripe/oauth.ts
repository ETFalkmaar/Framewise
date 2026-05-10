import { InvalidCredentialsError } from '../../errors';

import { mapStripeError, stripeNetworkError } from './errors';
import type { StripeOAuthTokenResponse } from './types';

const AUTHORIZE_URL = 'https://connect.stripe.com/oauth/authorize';
const TOKEN_URL = 'https://connect.stripe.com/oauth/token';
const DEFAULT_TOKEN_TIMEOUT_MS = 10_000;

/**
 * Resolved Stripe Connect platform credentials. Both fields are
 * required — without either we cannot drive the OAuth flow.
 */
export interface StripeOAuthConfig {
  clientId: string;
  secretKey: string;
}

/**
 * Read STRIPE_CLIENT_ID + STRIPE_SECRET_KEY from `process.env`. Returns
 * `null` (rather than throwing) when either is missing so the wizard
 * UI can show a friendly "configuration incomplete" banner instead of
 * a stack trace.
 *
 * The values are not logged anywhere; the secret key only ever leaves
 * memory as part of the `client_secret` form field on the
 * `oauth/token` POST.
 */
export function getStripeOAuthConfig(): StripeOAuthConfig | null {
  const clientId = process.env.STRIPE_CLIENT_ID?.trim();
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!clientId || !secretKey) return null;
  return { clientId, secretKey };
}

export interface BuildAuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  /** Defaults to `read_write` (Standard accounts). */
  scope?: 'read_write' | 'read_only';
  /** Optional `stripe_user[email]` etc. pre-fill — kept extensible. */
  prefill?: Record<string, string>;
}

/**
 * Build the full `https://connect.stripe.com/oauth/authorize?…` URL.
 * All query params are URL-encoded by `URLSearchParams`.
 *
 * Stripe's OAuth flow requires `response_type=code`, `client_id`,
 * `state`, and `scope`. `redirect_uri` is optional in Stripe's docs
 * (defaults to whatever's configured on the platform), but we always
 * pass it so the cookie-based state validation has a stable target.
 */
export function buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope: input.scope ?? 'read_write',
  });
  if (input.prefill) {
    for (const [k, v] of Object.entries(input.prefill)) {
      params.set(`stripe_user[${k}]`, v);
    }
  }
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface ExchangeCodeInput {
  /** Authorization code from the Stripe callback `?code=…`. */
  code: string;
  /** Platform secret key (`sk_test_*` or `sk_live_*`). */
  secretKey: string;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Override for tests. Default `https://connect.stripe.com/oauth/token`. */
  tokenUrl?: string;
  /** Per-request timeout in ms. Default 10s. */
  timeoutMs?: number;
}

/**
 * Exchange the OAuth `code` for an access token + connected-account id.
 *
 * Form-urlencoded body per Stripe's docs:
 *   client_secret=<sk_*>&code=<code>&grant_type=authorization_code
 *
 * Errors:
 * - 401 → `InvalidCredentialsError` (the secret key is rejected)
 * - 4xx with `error: invalid_grant` → mapped via `mapStripeError`
 *   (covers code reuse, expired codes, mismatching client_id)
 * - 5xx / network → `mapStripeError` / `stripeNetworkError`
 */
export async function exchangeCodeForToken(
  input: ExchangeCodeInput
): Promise<StripeOAuthTokenResponse> {
  const url = input.tokenUrl ?? TOKEN_URL;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TOKEN_TIMEOUT_MS;

  const body = new URLSearchParams({
    client_secret: input.secretKey,
    code: input.code,
    grant_type: 'authorization_code',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Framewise/1.0 (+https://framewise-pi.vercel.app)',
      },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      throw stripeNetworkError(`token exchange timed out after ${timeoutMs}ms`);
    }
    throw stripeNetworkError((err as Error).message ?? String(err));
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown = undefined;
  const text = await response.text();
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (response.status === 401) {
    const detail =
      parsed && typeof parsed === 'object' && 'error_description' in parsed
        ? String((parsed as Record<string, unknown>).error_description)
        : 'platform secret key rejected by Stripe';
    throw new InvalidCredentialsError('stripe', detail);
  }

  if (!response.ok) {
    throw mapStripeError(response, parsed);
  }

  // Light shape check — Stripe always returns these on success but a
  // rogue proxy could return HTML; better to reject early than poison
  // the connections row.
  const result = parsed as Partial<StripeOAuthTokenResponse> | null;
  if (
    !result ||
    typeof result.access_token !== 'string' ||
    typeof result.stripe_user_id !== 'string'
  ) {
    throw stripeNetworkError('Stripe token response missing required fields');
  }

  return result as StripeOAuthTokenResponse;
}

/** Public constant re-export for the connector's `oauth` config block. */
export const STRIPE_AUTHORIZE_URL = AUTHORIZE_URL;
export const STRIPE_TOKEN_URL = TOKEN_URL;
