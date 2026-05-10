import { InvalidCredentialsError } from '../../errors';

import {
  getPayPalApiBaseUrl,
  getPayPalAuthorizeBaseUrl,
  getPayPalEnvironment,
  type PayPalEnvironment,
} from './environment';
import { mapPayPalError, paypalNetworkError } from './errors';
import type { PayPalOAuthTokenResponse } from './types';

const DEFAULT_TOKEN_TIMEOUT_MS = 10_000;

/**
 * Default PayPal LIPP scope set. `openid` + `profile` + `email` cover
 * basic identity; the `paypalattributes` scope is what PayPal calls
 * "merchant info" and is required to receive a refresh token + the
 * `payer_id` field on the userinfo endpoint.
 */
export const DEFAULT_PAYPAL_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://uri.paypal.com/services/paypalattributes',
] as const;

export interface PayPalOAuthConfig {
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
}

/**
 * Read PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET from `process.env`.
 * Returns `null` (rather than throwing) when either is missing so
 * the wizard UI can render a friendly "configuration incomplete"
 * banner instead of a stack trace.
 *
 * The environment is always resolved (defaults to `sandbox`) so the
 * caller never has to repeat that fall-through.
 */
export function getPayPalOAuthConfig(): PayPalOAuthConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, environment: getPayPalEnvironment() };
}

export interface BuildAuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  environment: PayPalEnvironment;
  /** Defaults to {@link DEFAULT_PAYPAL_SCOPES}. */
  scopes?: readonly string[];
}

/**
 * Build the full `https://www.{sandbox.}paypal.com/connect?…` URL.
 *
 * PayPal's LIPP flow expects scopes joined by a literal space. We
 * URL-encode via `URLSearchParams` so the space becomes `+` (which
 * PayPal accepts identically to `%20`).
 */
export function buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const base = getPayPalAuthorizeBaseUrl(input.environment);
  const scopes = (input.scopes ?? DEFAULT_PAYPAL_SCOPES).join(' ');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope: scopes,
  });
  return `${base}?${params.toString()}`;
}

export interface ExchangeCodeInput {
  /** Authorization code from the PayPal callback `?code=…`. */
  code: string;
  /** Platform client id (`AY…`-shaped from developer.paypal.com). */
  clientId: string;
  /** Platform client secret. */
  clientSecret: string;
  /** Must match the redirect_uri used during `/connect`. */
  redirectUri: string;
  /** Sandbox vs live — drives the token URL. */
  environment: PayPalEnvironment;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Override for tests / staging. Defaults to env-based URL. */
  tokenUrl?: string;
  /** Per-request timeout in ms. Default 10s. */
  timeoutMs?: number;
}

/**
 * Exchange the OAuth `code` for an access token + refresh token.
 *
 * PayPal expects HTTP Basic auth (clientId:clientSecret base64) on
 * the token endpoint, with a form-urlencoded body:
 *   grant_type=authorization_code
 *   &code=<code>
 *   &redirect_uri=<…>
 *
 * Errors:
 * - 401 → `InvalidCredentialsError` (clientId/secret wrong)
 * - 400 with `error: invalid_grant` → mapped via `mapPayPalError`
 *   (covers code reuse, expired codes, mismatching redirect_uri)
 * - 5xx / network → `mapPayPalError` / `paypalNetworkError`
 */
export async function exchangeCodeForToken(
  input: ExchangeCodeInput
): Promise<PayPalOAuthTokenResponse> {
  const url = input.tokenUrl ?? `${getPayPalApiBaseUrl(input.environment)}/v1/oauth2/token`;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TOKEN_TIMEOUT_MS;

  // Buffer / btoa parity for Node + edge runtimes.
  const credentials = `${input.clientId}:${input.clientSecret}`;
  const basic =
    typeof Buffer !== 'undefined'
      ? Buffer.from(credentials, 'utf8').toString('base64')
      : btoa(credentials);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Framewise/1.0 (+https://framewise-pi.vercel.app)',
      },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      throw paypalNetworkError(`token exchange timed out after ${timeoutMs}ms`);
    }
    throw paypalNetworkError((err as Error).message ?? String(err));
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
        : 'PayPal client credentials rejected';
    throw new InvalidCredentialsError('paypal-business', detail);
  }

  if (!response.ok) {
    throw mapPayPalError(response, parsed);
  }

  // Light shape check — PayPal always returns these on success but a
  // rogue proxy could return HTML; better to reject early than poison
  // the connections row.
  const result = parsed as Partial<PayPalOAuthTokenResponse> | null;
  if (!result || typeof result.access_token !== 'string') {
    throw paypalNetworkError('PayPal token response missing access_token');
  }

  return result as PayPalOAuthTokenResponse;
}
