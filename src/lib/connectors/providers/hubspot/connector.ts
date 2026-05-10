// IMPORTANT: import from internal modules — see step-15 Moneybird
// circular-dep note for the why.
import type { CountryCode } from '@/lib/countries';

import { BaseConnector } from '../../base';
import { ConnectorError, InvalidCredentialsError } from '../../errors';
import type { ConnectorContext, ConnectorDefinition, OAuthCallbackResult } from '../../types';

import { HubSpotClient, type HubSpotClientOptions } from './client';
import { configurationIncomplete, HUBSPOT_ERROR_CODES } from './errors';
import {
  buildAuthorizeUrl,
  DEFAULT_HUBSPOT_SCOPES,
  exchangeCodeForToken,
  getHubSpotOAuthConfig,
  HUBSPOT_AUTHORIZE_URL,
  HUBSPOT_TOKEN_URL,
} from './oauth';
import type { HubSpotMetadata } from './types';

/** Canonical callback URL the framework router emits for this connector. */
const FALLBACK_CALLBACK_PATH = '/api/connectors/oauth/callback?providerId=hubspot';

/**
 * HubSpot CRM — first CRM connector.
 *
 * Internationally available (NL + CW). HubSpot's free tier means
 * every Framewise tenant can use it without a budget question.
 *
 * Authentication: standard OAuth 2.0 authorization-code flow with
 * `oauth` + `crm.objects.contacts.read` + `crm.objects.contacts.write`
 * scopes — minimum needed for the AI agent's lead-sync flow in
 * step 21+. The customer keeps full control of their HubSpot Hub;
 * Framewise only ever holds a Bearer token + refresh token.
 *
 * Two framework hooks override the generic OAuth orchestrator,
 * same pattern as Stripe (step 18) and PayPal (step 19):
 *
 *  - `getAuthorizeUrl` builds the canonical HubSpot URL with the
 *    real `client_id` from env vars.
 *  - `handleOAuthCallback` runs the form-urlencoded token exchange
 *    and probes `/account-info/v3/details` for metadata.
 *
 * HubSpot requires `redirect_uri` on the token endpoint to match
 * the authorize call. Same instance-cache pattern as PayPal.
 *
 * No test/live mode — HubSpot accounts are always "live", so the
 * connection card shows the Hub identifier without any badge.
 */
export class HubSpotConnector extends BaseConnector {
  readonly id = 'hubspot';
  readonly category = 'crm' as const;
  readonly authMethod = 'oauth' as const;
  // Mutable shape required by `BaseConnector.availableIn: CountryCode[]`.
  availableIn: CountryCode[] = ['NL', 'CW'];

  /** Test seam — production code never sets this. */
  private readonly clientOverrides?: Pick<HubSpotClientOptions, 'baseUrl' | 'fetchImpl'>;
  private readonly oauthOverrides?: {
    fetchImpl?: typeof fetch;
    tokenUrl?: string;
    /** Forces config resolution. `null` simulates missing env vars. */
    config?: { clientId: string; clientSecret: string } | null;
  };

  /**
   * Last redirect URI passed through `getAuthorizeUrl`. HubSpot pins
   * `redirect_uri` to whatever the authorize call used, so we
   * capture it during `start` and echo it back during `callback`.
   * Within a single request lifecycle on Vercel/Node this is
   * sufficient — both routes share the same Lambda instance because
   * the cookie keeps the OAuth state. Cold-start fallback
   * reconstructs from `NEXT_PUBLIC_BASE_URL` (see `resolveRedirectUri`).
   */
  private lastRedirectUri?: string;

  constructor(overrides?: {
    clientOverrides?: Pick<HubSpotClientOptions, 'baseUrl' | 'fetchImpl'>;
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
      authorizeUrl: HUBSPOT_AUTHORIZE_URL,
      tokenUrl: HUBSPOT_TOKEN_URL,
      scopes: [...DEFAULT_HUBSPOT_SCOPES],
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
    return getHubSpotOAuthConfig();
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
        error: 'HubSpot Connect not yet configured. Contact support.',
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
      return { ok: false, error: 'Failed to exchange HubSpot authorization code' };
    }

    // Probe account-info for the Hub identifier and human-readable
    // metadata. Failure here is non-fatal — we already have a valid
    // access_token, so we degrade to "minimal metadata" instead of
    // failing the whole flow.
    let metadata: HubSpotMetadata = {};

    try {
      const client = new HubSpotClient({
        accessToken: tokens.access_token,
        timeoutMs: 5_000,
        ...this.clientOverrides,
      });
      const info = await client.getAccountInfo();
      metadata = {
        portal_id: String(info.portalId),
        account_type: info.accountType,
        company_currency: info.companyCurrency,
        ui_domain: info.uiDomain,
        time_zone: info.timeZone,
      };
    } catch {
      // Swallow: metadata is "best-effort" enrichment.
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1_000).toISOString();
    metadata.expires_at = expiresAt;

    const credentials: Record<string, string> = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    };

    return {
      ok: true,
      credentials,
      metadata: metadata as Record<string, unknown>,
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
export { HUBSPOT_ERROR_CODES };

export const hubspotConnector: ConnectorDefinition = new HubSpotConnector();
