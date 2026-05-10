import { InvalidCredentialsError } from '../../errors';

import { mapPipedriveError, pipedriveNetworkError } from './errors';
import type { PipedriveOAuthTokenResponse } from './types';

const AUTHORIZE_URL = 'https://oauth.pipedrive.com/oauth/authorize';
const TOKEN_URL = 'https://oauth.pipedrive.com/oauth/token';
const DEFAULT_TOKEN_TIMEOUT_MS = 10_000;

/**
 * Default Pipedrive scope set. Configured in the Pipedrive app
 * registration, NOT in the authorize URL — Pipedrive's OAuth flow
 * doesn't accept a `scope` query parameter; it uses whatever's set
 * up in the developer dashboard. We declare them here for the
 * connector definition + debug card so operators can see what to
 * tick when they create the app.
 */
export const DEFAULT_PIPEDRIVE_SCOPES = ['base', 'contacts:read', 'contacts:full'] as const;

export interface PipedriveOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Read PIPEDRIVE_CLIENT_ID + PIPEDRIVE_CLIENT_SECRET from
 * `process.env`. Returns `null` (rather than throwing) when either
 * is missing so the wizard UI can render a friendly "configuration
 * incomplete" banner instead of a stack trace.
 */
export function getPipedriveOAuthConfig(): PipedriveOAuthConfig | null {
  const clientId = process.env.PIPEDRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export interface BuildAuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
}

/**
 * Build the full `https://oauth.pipedrive.com/oauth/authorize?…` URL.
 *
 * Pipedrive specifically does NOT take a `scope` query param in the
 * authorize URL — scopes are configured in the app registration.
 * Tests assert the parameter is absent so future "helpful" edits
 * don't regress the contract.
 */
export function buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface ExchangeCodeInput {
  /** Authorization code from the Pipedrive callback `?code=…`. */
  code: string;
  /** Platform client id from developers.pipedrive.com. */
  clientId: string;
  /** Platform client secret. */
  clientSecret: string;
  /** Must match the redirect_uri configured on the Pipedrive app. */
  redirectUri: string;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Override for tests / staging. Defaults to `https://oauth.pipedrive.com/oauth/token`. */
  tokenUrl?: string;
  /** Per-request timeout in ms. Default 10s. */
  timeoutMs?: number;
}

/**
 * Exchange the OAuth `code` for an access + refresh token pair.
 *
 * Pipedrive expects HTTP Basic auth (clientId:clientSecret base64)
 * with a form-urlencoded body — same shape as PayPal but a different
 * host (`oauth.pipedrive.com` instead of the API domain):
 *   grant_type=authorization_code
 *   &code=<code>
 *   &redirect_uri=<…>
 *
 * The response includes `api_domain`, the region-specific REST root.
 * We validate both `refresh_token` and `api_domain` are present —
 * without either we cannot drive the rest of the connector — and
 * throw `NETWORK_ERROR` if they're missing (rogue proxy guard, same
 * as HubSpot step 20).
 *
 * Errors:
 * - 401 → `InvalidCredentialsError` (clientId/secret wrong)
 * - 400 with `error: invalid_grant` → mapped via `mapPipedriveError`
 *   (covers code reuse, expired codes, mismatching redirect_uri)
 * - 5xx / network → `mapPipedriveError` / `pipedriveNetworkError`
 */
export async function exchangeCodeForToken(
  input: ExchangeCodeInput
): Promise<PipedriveOAuthTokenResponse> {
  const url = input.tokenUrl ?? TOKEN_URL;
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
      throw pipedriveNetworkError(`token exchange timed out after ${timeoutMs}ms`);
    }
    throw pipedriveNetworkError((err as Error).message ?? String(err));
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
        : 'Pipedrive client credentials rejected';
    throw new InvalidCredentialsError('pipedrive', detail);
  }

  if (!response.ok) {
    throw mapPipedriveError(response, parsed);
  }

  // Light shape check — Pipedrive always returns these on success
  // but a rogue proxy could return HTML; better to reject early than
  // poison the connections row.
  const result = parsed as Partial<PipedriveOAuthTokenResponse> | null;
  if (
    !result ||
    typeof result.access_token !== 'string' ||
    typeof result.refresh_token !== 'string'
  ) {
    throw pipedriveNetworkError('Pipedrive token response missing access_token or refresh_token');
  }
  if (typeof result.api_domain !== 'string' || result.api_domain.length === 0) {
    throw pipedriveNetworkError('Pipedrive token response missing api_domain');
  }

  return result as PipedriveOAuthTokenResponse;
}

/** Public constants for the connector's `oauth` config block. */
export const PIPEDRIVE_AUTHORIZE_URL = AUTHORIZE_URL;
export const PIPEDRIVE_TOKEN_URL = TOKEN_URL;
