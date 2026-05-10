import { InvalidCredentialsError } from '../../errors';

import { mapHubSpotError, hubspotNetworkError } from './errors';
import type { HubSpotOAuthTokenResponse } from './types';

const AUTHORIZE_URL = 'https://app.hubspot.com/oauth/authorize';
const TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const DEFAULT_TOKEN_TIMEOUT_MS = 10_000;

/**
 * Default HubSpot scope set. Minimum needed for the lead-sync use
 * case the AI agent will drive in step 21+:
 *
 *   - `oauth` — basic OAuth scope, required by HubSpot
 *   - `crm.objects.contacts.read` — needed to dedupe before insert
 *   - `crm.objects.contacts.write` — needed to push captured leads
 */
export const DEFAULT_HUBSPOT_SCOPES = [
  'oauth',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
] as const;

export interface HubSpotOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Read HUBSPOT_CLIENT_ID + HUBSPOT_CLIENT_SECRET from `process.env`.
 * Returns `null` (rather than throwing) when either is missing so
 * the wizard UI can render a friendly "configuration incomplete"
 * banner instead of a stack trace.
 */
export function getHubSpotOAuthConfig(): HubSpotOAuthConfig | null {
  const clientId = process.env.HUBSPOT_CLIENT_ID?.trim();
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export interface BuildAuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  /** Defaults to {@link DEFAULT_HUBSPOT_SCOPES}. */
  scopes?: readonly string[];
}

/**
 * Build the full `https://app.hubspot.com/oauth/authorize?…` URL.
 *
 * HubSpot's OAuth flow expects scopes joined by a literal space.
 * `URLSearchParams` encodes spaces as `+` (which HubSpot accepts
 * identically to `%20`), so we don't have to special-case it.
 */
export function buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const scopes = (input.scopes ?? DEFAULT_HUBSPOT_SCOPES).join(' ');
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: scopes,
    state: input.state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface ExchangeCodeInput {
  /** Authorization code from the HubSpot callback `?code=…`. */
  code: string;
  /** Platform client id (`xxx`-shaped from developers.hubspot.com). */
  clientId: string;
  /** Platform client secret. */
  clientSecret: string;
  /** Must match the redirect_uri used during `/authorize`. */
  redirectUri: string;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Override for tests / staging. Defaults to `https://api.hubapi.com/oauth/v1/token`. */
  tokenUrl?: string;
  /** Per-request timeout in ms. Default 10s. */
  timeoutMs?: number;
}

/**
 * Exchange the OAuth `code` for an access token + refresh token.
 *
 * HubSpot expects a form-urlencoded body with the client credentials
 * inline (not Basic auth — different from PayPal):
 *   grant_type=authorization_code
 *   &client_id=<id>
 *   &client_secret=<secret>
 *   &redirect_uri=<…>
 *   &code=<code>
 *
 * Errors:
 * - 401 → `InvalidCredentialsError` (clientId/secret wrong)
 * - 400 with `BAD_AUTH_CODE` → mapped via `mapHubSpotError`
 *   (covers code reuse, expired codes, mismatching redirect_uri)
 * - 5xx / network → `mapHubSpotError` / `hubspotNetworkError`
 */
export async function exchangeCodeForToken(
  input: ExchangeCodeInput
): Promise<HubSpotOAuthTokenResponse> {
  const url = input.tokenUrl ?? TOKEN_URL;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TOKEN_TIMEOUT_MS;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
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
      throw hubspotNetworkError(`token exchange timed out after ${timeoutMs}ms`);
    }
    throw hubspotNetworkError((err as Error).message ?? String(err));
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
      parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as Record<string, unknown>).message)
        : 'HubSpot client credentials rejected';
    throw new InvalidCredentialsError('hubspot', detail);
  }

  if (!response.ok) {
    throw mapHubSpotError(response, parsed);
  }

  // Light shape check — HubSpot always returns these on success but a
  // rogue proxy could return HTML; better to reject early than poison
  // the connections row.
  const result = parsed as Partial<HubSpotOAuthTokenResponse> | null;
  if (
    !result ||
    typeof result.access_token !== 'string' ||
    typeof result.refresh_token !== 'string'
  ) {
    throw hubspotNetworkError('HubSpot token response missing access_token or refresh_token');
  }

  return result as HubSpotOAuthTokenResponse;
}

/** Public constants for the connector's `oauth` config block. */
export const HUBSPOT_AUTHORIZE_URL = AUTHORIZE_URL;
export const HUBSPOT_TOKEN_URL = TOKEN_URL;
