// IMPORTANT: import from internal modules — see step-15 Moneybird
// circular-dep note for the why.
import type { CountryCode } from '@/lib/countries';

import { BaseConnector } from '../../base';
import { ConnectorError, InvalidCredentialsError } from '../../errors';
import type { ConnectorContext, ConnectorDefinition, OAuthCallbackResult } from '../../types';

import { PipedriveClient, type PipedriveClientOptions } from './client';
import { configurationIncomplete, PIPEDRIVE_ERROR_CODES } from './errors';
import {
  buildAuthorizeUrl,
  DEFAULT_PIPEDRIVE_SCOPES,
  exchangeCodeForToken,
  getPipedriveOAuthConfig,
  PIPEDRIVE_AUTHORIZE_URL,
  PIPEDRIVE_TOKEN_URL,
} from './oauth';
import type { PipedriveMetadata } from './types';

/** Canonical callback URL the framework router emits for this connector. */
const FALLBACK_CALLBACK_PATH = '/api/connectors/oauth/callback?providerId=pipedrive';

/**
 * Pipedrive CRM — second CRM connector (after HubSpot in step 20).
 *
 * Sales-focused CRM: deal pipelines are the central abstraction.
 * Customers can pick HubSpot for marketing-CRM use cases or
 * Pipedrive for sales-CRM use cases. The two connectors live
 * side-by-side under the same `crm` category in the hub UI.
 *
 * Region-specific API: the OAuth token response contains an
 * `api_domain` field (e.g. `https://framewise-test.pipedrive.com`).
 * Every REST call goes against that host — Pipedrive doesn't have
 * a single global API root. We persist `api_domain` on the
 * credentials envelope so future steps don't have to re-derive it.
 *
 * Three framework hooks override the generic OAuth orchestrator:
 *
 *  - `getAuthorizeUrl` builds the canonical Pipedrive URL with the
 *    real `client_id` from env vars. Pipedrive specifically does
 *    NOT take a `scope` query param — scopes are configured in the
 *    app registration.
 *  - `handleOAuthCallback` runs the Basic-auth token exchange,
 *    extracts `api_domain` from the response, and probes
 *    `/api/v1/users/me` for metadata.
 *  - PayPal-style redirect_uri pinning via `lastRedirectUri` cache.
 *
 * No test/live mode — Pipedrive companies are always "live"
 * (sandbox companies are a developer feature, not a separate
 * environment), so the connection card just shows the company name.
 */
export class PipedriveConnector extends BaseConnector {
  readonly id = 'pipedrive';
  readonly category = 'crm' as const;
  readonly authMethod = 'oauth' as const;
  // Mutable shape required by `BaseConnector.availableIn: CountryCode[]`.
  availableIn: CountryCode[] = ['NL', 'CW'];

  /** Test seam — production code never sets this. */
  private readonly clientOverrides?: Pick<PipedriveClientOptions, 'fetchImpl'>;
  private readonly oauthOverrides?: {
    fetchImpl?: typeof fetch;
    tokenUrl?: string;
    /** Forces config resolution. `null` simulates missing env vars. */
    config?: { clientId: string; clientSecret: string } | null;
  };

  /**
   * Last redirect URI passed through `getAuthorizeUrl`. Pipedrive
   * pins `redirect_uri` to whatever the authorize call used (well —
   * to whatever was configured on the app registration, which the
   * caller has to mirror in the URL). Same instance-cache pattern
   * as PayPal/HubSpot.
   */
  private lastRedirectUri?: string;

  constructor(overrides?: {
    clientOverrides?: Pick<PipedriveClientOptions, 'fetchImpl'>;
    oauthOverrides?: {
      fetchImpl?: typeof fetch;
      tokenUrl?: string;
      config?: { clientId: string; clientSecret: string } | null;
    };
  }) {
    super();
    this.clientOverrides = overrides?.clientOverrides;
    this.oauthOverrides = overrides?.oauthOverrides;
    this.oauth = {
      authorizeUrl: PIPEDRIVE_AUTHORIZE_URL,
      tokenUrl: PIPEDRIVE_TOKEN_URL,
      scopes: [...DEFAULT_PIPEDRIVE_SCOPES],
      requiresClientSecret: true,
      pkce: false,
    };
  }

  /**
   * Resolve the OAuth config — env vars in production, override in
   * tests. Centralised so both `getAuthorizeUrl` and
   * `handleOAuthCallback` see the same values.
   */
  private resolveConfig(): { clientId: string; clientSecret: string } | null {
    if (this.oauthOverrides && 'config' in this.oauthOverrides) {
      return this.oauthOverrides.config ?? null;
    }
    return getPipedriveOAuthConfig();
  }

  /** Whether the platform is ready to drive an OAuth handshake. */
  hasConfig(): boolean {
    return this.resolveConfig() !== null;
  }

  async getAuthorizeUrl(input: { state: string; callbackUrl: string }): Promise<string> {
    const config = this.resolveConfig();
    if (!config) {
      throw configurationIncomplete();
    }
    // Stash the URL for `handleOAuthCallback` to echo back.
    this.lastRedirectUri = input.callbackUrl;
    return buildAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: input.callbackUrl,
      state: input.state,
    });
  }

  async handleOAuthCallback(input: {
    code: string;
    state: string;
    context: ConnectorContext;
  }): Promise<OAuthCallbackResult> {
    const config = this.resolveConfig();
    if (!config) {
      return {
        ok: false,
        error: 'Pipedrive Connect not yet configured. Contact support.',
      };
    }

    const redirectUri = this.resolveRedirectUri();

    let tokens;
    try {
      tokens = await exchangeCodeForToken({
        code: input.code,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri,
        fetchImpl: this.oauthOverrides?.fetchImpl,
        tokenUrl: this.oauthOverrides?.tokenUrl,
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return { ok: false, error: err.message };
      }
      if (err instanceof ConnectorError) {
        return { ok: false, error: `${err.code}: ${err.message}` };
      }
      return { ok: false, error: 'Failed to exchange Pipedrive authorization code' };
    }

    // Probe /users/me on the connected account's region-specific
    // host to derive readable metadata. Failure here is non-fatal —
    // we already have a valid access_token + api_domain, so degrade
    // to "minimal metadata" instead of failing the whole flow.
    let metadata: PipedriveMetadata = {
      api_domain: tokens.api_domain,
    };

    try {
      const client = new PipedriveClient({
        accessToken: tokens.access_token,
        apiDomain: tokens.api_domain,
        timeoutMs: 5_000,
        ...this.clientOverrides,
      });
      const user = await client.getCurrentUser();
      metadata = {
        user_id: String(user.id),
        user_name: user.name,
        company_id: String(user.company_id),
        company_name: user.company_name,
        company_domain: user.company_domain,
        api_domain: tokens.api_domain,
        locale: user.language?.language_code ?? user.locale,
        currency: user.default_currency,
      };
    } catch {
      // Swallow: metadata is "best-effort" enrichment.
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1_000).toISOString();

    const credentials: Record<string, string> = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      // Persist api_domain so future steps don't need /users/me again.
      api_domain: tokens.api_domain,
      expires_at: expiresAt,
    };

    return {
      ok: true,
      credentials,
      metadata: { ...metadata, expires_at: expiresAt } as Record<string, unknown>,
    };
  }

  /**
   * Resolve the redirect URI for the token exchange. Prefers the
   * cached value from a same-instance `getAuthorizeUrl` call;
   * otherwise reconstructs the canonical URL the route handler emits.
   */
  private resolveRedirectUri(): string {
    if (this.lastRedirectUri) return this.lastRedirectUri;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
    return `${baseUrl ?? 'https://framewise-pi.vercel.app'}${FALLBACK_CALLBACK_PATH}`;
  }
}

/** Public error code re-export for callers reaching for `ConnectorError.code`. */
export { PIPEDRIVE_ERROR_CODES };

export const pipedriveConnector: ConnectorDefinition = new PipedriveConnector();
