import { InvalidCredentialsError } from '../../errors';

import { mailchimpNetworkError, mapMailchimpError } from './errors';
import type { MailchimpMetadata, MailchimpOAuthTokenResponse } from './types';

const AUTHORIZE_URL = 'https://login.mailchimp.com/oauth2/authorize';
const TOKEN_URL = 'https://login.mailchimp.com/oauth2/token';
const METADATA_URL = 'https://login.mailchimp.com/oauth2/metadata';
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Framewise/1.0 (+https://framewise-pi.vercel.app)';

export interface MailchimpOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Read MAILCHIMP_CLIENT_ID + MAILCHIMP_CLIENT_SECRET from
 * `process.env`. Returns `null` (rather than throwing) when either
 * is missing so the wizard UI can render a friendly "configuration
 * incomplete" banner instead of a stack trace.
 */
export function getMailchimpOAuthConfig(): MailchimpOAuthConfig | null {
  const clientId = process.env.MAILCHIMP_CLIENT_ID?.trim();
  const clientSecret = process.env.MAILCHIMP_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export interface BuildAuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
}

/**
 * Build the full `https://login.mailchimp.com/oauth2/authorize?…` URL.
 *
 * Mailchimp specifically does NOT take a `scope` query param (Mailchimp
 * doesn't ship a scopes system — access is governed by the connected
 * user's own permissions). Tests assert the parameter is absent.
 */
export function buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface ExchangeCodeInput {
  /** Authorization code from the Mailchimp callback `?code=…`. */
  code: string;
  /** Platform client id from login.mailchimp.com → Profile → Extras → Registered apps. */
  clientId: string;
  /** Platform client secret. */
  clientSecret: string;
  /** Must match the redirect_uri configured on the Mailchimp app. */
  redirectUri: string;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Override for tests / staging. Defaults to `https://login.mailchimp.com/oauth2/token`. */
  tokenUrl?: string;
  /** Per-request timeout in ms. Default 10s. */
  timeoutMs?: number;
}

/**
 * Exchange the OAuth `code` for an access token.
 *
 * Mailchimp expects a form-urlencoded body with the client
 * credentials inline (NOT Basic auth):
 *   grant_type=authorization_code
 *   &client_id=<id>
 *   &client_secret=<secret>
 *   &redirect_uri=<…>
 *   &code=<code>
 *
 * Note: Mailchimp tokens are PERMANENT — there's no `refresh_token`
 * in the response. `expires_in` is 0.
 *
 * Errors:
 * - 401 → `InvalidCredentialsError` (clientId/secret wrong)
 * - 400 with `error: invalid_grant` → mapped via `mapMailchimpError`
 * - 5xx / network → `mapMailchimpError` / `mailchimpNetworkError`
 */
export async function exchangeCodeForToken(
  input: ExchangeCodeInput
): Promise<MailchimpOAuthTokenResponse> {
  const url = input.tokenUrl ?? TOKEN_URL;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

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
        'User-Agent': USER_AGENT,
      },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      throw mailchimpNetworkError(`token exchange timed out after ${timeoutMs}ms`);
    }
    throw mailchimpNetworkError((err as Error).message ?? String(err));
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
        : 'Mailchimp client credentials rejected';
    throw new InvalidCredentialsError('mailchimp', detail);
  }

  if (!response.ok) {
    throw mapMailchimpError(response, parsed);
  }

  // Light shape check — Mailchimp always returns access_token on
  // success but a rogue proxy could return HTML; better to reject
  // early than poison the connections row.
  const result = parsed as Partial<MailchimpOAuthTokenResponse> | null;
  if (!result || typeof result.access_token !== 'string') {
    throw mailchimpNetworkError('Mailchimp token response missing access_token');
  }

  return {
    access_token: result.access_token,
    expires_in: typeof result.expires_in === 'number' ? result.expires_in : 0,
    scope: typeof result.scope === 'string' ? result.scope : null,
  };
}

export interface FetchMetadataInput {
  /** Permanent OAuth `access_token` from `exchangeCodeForToken`. */
  accessToken: string;
  /** Test seam — defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Override for tests / staging. Defaults to `https://login.mailchimp.com/oauth2/metadata`. */
  metadataUrl?: string;
  /** Per-request timeout in ms. Default 10s. */
  timeoutMs?: number;
}

/**
 * Fetch the OAuth metadata for the freshly-issued access token.
 *
 * This is the ONLY way to discover the data-center prefix (`dc`)
 * and the resolved region-specific API endpoint
 * (`https://us1.api.mailchimp.com`). We call this once during the
 * callback flow and cache the result on the credentials envelope.
 *
 * Note the `Authorization: OAuth <token>` shape — NOT `Bearer`.
 * Tests assert this exact wire format.
 */
export async function fetchMetadata(input: FetchMetadataInput): Promise<MailchimpMetadata> {
  const url = input.metadataUrl ?? METADATA_URL;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        // `OAuth` prefix — same as the v3 client.
        Authorization: `OAuth ${input.accessToken}`,
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      throw mailchimpNetworkError(`metadata fetch timed out after ${timeoutMs}ms`);
    }
    throw mailchimpNetworkError((err as Error).message ?? String(err));
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
    throw new InvalidCredentialsError(
      'mailchimp',
      'Mailchimp metadata fetch rejected — access token invalid or revoked'
    );
  }

  if (!response.ok) {
    throw mapMailchimpError(response, parsed);
  }

  const result = parsed as Partial<MailchimpMetadata> | null;
  if (
    !result ||
    typeof result.dc !== 'string' ||
    typeof result.api_endpoint !== 'string' ||
    result.api_endpoint.length === 0
  ) {
    throw mailchimpNetworkError('Mailchimp metadata response missing dc or api_endpoint');
  }

  return result as MailchimpMetadata;
}

/** Public constants for the connector's `oauth` config block. */
export const MAILCHIMP_AUTHORIZE_URL = AUTHORIZE_URL;
export const MAILCHIMP_TOKEN_URL = TOKEN_URL;
export const MAILCHIMP_METADATA_URL = METADATA_URL;
