// IMPORTANT: import from internal modules — see step-15 Moneybird
// circular-dep note for the why.
import type { CountryCode } from '@/lib/countries';

import { BaseConnector } from '../../base';
import { ConnectorError, InvalidCredentialsError } from '../../errors';
import type { ConnectorContext, ConnectorDefinition, OAuthCallbackResult } from '../../types';

import { MailchimpClient, type MailchimpClientOptions } from './client';
import { configurationIncomplete, MAILCHIMP_ERROR_CODES } from './errors';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchMetadata,
  getMailchimpOAuthConfig,
  MAILCHIMP_AUTHORIZE_URL,
  MAILCHIMP_TOKEN_URL,
} from './oauth';
import type { MailchimpConnectorMetadata } from './types';

/** Canonical callback URL the framework router emits for this connector. */
const FALLBACK_CALLBACK_PATH = '/api/connectors/oauth/callback?providerId=mailchimp';

/**
 * Mailchimp — last connector. Phase 6/7 complete: 9 connectors live.
 *
 * Second newsletter / email-marketing connector after Brevo (step
 * 22). Brevo focuses on transactional + EU GDPR; Mailchimp focuses
 * on marketing automation + a richer template library. Both live
 * side-by-side under `newsletter` so customers can pick.
 *
 * Three Mailchimp-specific quirks (none of the previous connectors
 * have all three together):
 *
 *  1. **3-step handshake**: `token → metadata → account`. The
 *     metadata endpoint is the only way to discover the data-center
 *     prefix; the API host then becomes `<dc>.api.mailchimp.com`.
 *     We persist `api_endpoint` on the credentials so future REST
 *     calls don't need step 2 again.
 *  2. **`Authorization: OAuth <token>`** (NOT `Bearer`). Most
 *     common Mailchimp integration mistake. Tests guard against it.
 *  3. **Permanent tokens, no refresh**: Mailchimp tokens never
 *     expire and there's no refresh flow. `expires_in` from the
 *     token endpoint is always 0; we don't persist `expires_at`.
 *
 * Reuses patterns from earlier steps:
 *  - OAuth override pattern (Stripe/PayPal/HubSpot/Pipedrive).
 *  - Region-aware client constructor (Pipedrive's `apiDomain` →
 *    Mailchimp's `apiEndpoint`).
 *  - PayPal-style redirect_uri pinning via instance cache.
 *  - Free-tier badge logic (Brevo's `is_free_tier` →
 *    Mailchimp's `pricing_plan_type === 'forever_free'`).
 */
export class MailchimpConnector extends BaseConnector {
  readonly id = 'mailchimp';
  readonly category = 'newsletter' as const;
  readonly authMethod = 'oauth' as const;
  // Mutable shape required by `BaseConnector.availableIn: CountryCode[]`.
  availableIn: CountryCode[] = ['NL', 'CW'];

  /** Test seam — production code never sets this. */
  private readonly clientOverrides?: Pick<MailchimpClientOptions, 'fetchImpl'>;
  private readonly oauthOverrides?: {
    fetchImpl?: typeof fetch;
    tokenUrl?: string;
    metadataUrl?: string;
    /** Forces config resolution. `null` simulates missing env vars. */
    config?: { clientId: string; clientSecret: string } | null;
  };

  /**
   * Last redirect URI passed through `getAuthorizeUrl`. Mailchimp
   * pins `redirect_uri` to whatever the authorize call used, so we
   * capture it during `start` and echo it back during `callback`.
   * Same instance-cache pattern as PayPal/HubSpot/Pipedrive.
   */
  private lastRedirectUri?: string;

  constructor(overrides?: {
    clientOverrides?: Pick<MailchimpClientOptions, 'fetchImpl'>;
    oauthOverrides?: {
      fetchImpl?: typeof fetch;
      tokenUrl?: string;
      metadataUrl?: string;
      config?: { clientId: string; clientSecret: string } | null;
    };
  }) {
    super();
    this.clientOverrides = overrides?.clientOverrides;
    this.oauthOverrides = overrides?.oauthOverrides;
    this.oauth = {
      authorizeUrl: MAILCHIMP_AUTHORIZE_URL,
      tokenUrl: MAILCHIMP_TOKEN_URL,
      // Mailchimp doesn't ship a scopes system — empty array is the
      // accurate description. The framework's debug card knows how
      // to render this.
      scopes: [],
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
    return getMailchimpOAuthConfig();
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
        error: 'Mailchimp Connect not yet configured. Contact support.',
      };
    }

    const redirectUri = this.resolveRedirectUri();

    // Step 1: Exchange the code for a permanent access token.
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
      return { ok: false, error: 'Failed to exchange Mailchimp authorization code' };
    }

    // Step 2: Fetch metadata to discover the data-center prefix.
    let mcMeta;
    try {
      mcMeta = await fetchMetadata({
        accessToken: tokens.access_token,
        fetchImpl: this.oauthOverrides?.fetchImpl,
        metadataUrl: this.oauthOverrides?.metadataUrl,
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return { ok: false, error: err.message };
      }
      if (err instanceof ConnectorError) {
        return { ok: false, error: `${err.code}: ${err.message}` };
      }
      return { ok: false, error: 'Failed to fetch Mailchimp account metadata' };
    }

    // Step 3: Probe `/3.0/` on the region-specific host for the
    // user-facing account info. Failure here is non-fatal — we
    // already have a valid access_token + api_endpoint, so we
    // degrade to "minimal metadata" instead of failing the whole
    // flow.
    let metadata: MailchimpConnectorMetadata = {
      dc: mcMeta.dc,
      api_endpoint: mcMeta.api_endpoint,
      account_name: mcMeta.accountname,
      login_email: mcMeta.login.login_email,
    };

    try {
      const client = new MailchimpClient({
        accessToken: tokens.access_token,
        apiEndpoint: mcMeta.api_endpoint,
        timeoutMs: 5_000,
        ...this.clientOverrides,
      });
      const account = await client.getAccount();
      const fullName = `${account.first_name ?? ''} ${account.last_name ?? ''}`.trim();
      metadata = {
        account_id: account.account_id,
        account_name: account.account_name,
        email: account.email,
        login_email: mcMeta.login.login_email,
        full_name: fullName.length > 0 ? fullName : undefined,
        dc: mcMeta.dc,
        api_endpoint: mcMeta.api_endpoint,
        pricing_plan_type: account.pricing_plan_type,
        total_subscribers: account.total_subscribers,
        is_free_tier: account.pricing_plan_type === 'forever_free',
        account_timezone: account.account_timezone,
      };
    } catch {
      // Swallow: metadata is "best-effort" enrichment. We still
      // have dc + api_endpoint + account name from the metadata
      // endpoint, which is enough for the connection card.
    }

    const credentials: Record<string, string> = {
      access_token: tokens.access_token,
      // Persist api_endpoint + dc so future steps don't need
      // /oauth2/metadata again.
      api_endpoint: mcMeta.api_endpoint,
      dc: mcMeta.dc,
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
export { MAILCHIMP_ERROR_CODES };

export const mailchimpConnector: ConnectorDefinition = new MailchimpConnector();
