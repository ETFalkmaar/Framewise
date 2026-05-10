// IMPORTANT: import from internal modules — see step-15 Moneybird
// circular-dep note for the why.
import type { CountryCode } from '@/lib/countries';

import { BaseConnector } from '../../base';
import { ConnectorError, InvalidCredentialsError } from '../../errors';
import type { ConnectorContext, ConnectorDefinition, OAuthCallbackResult } from '../../types';

import { PayPalClient, type PayPalClientOptions } from './client';
import {
  getPayPalApiBaseUrl,
  getPayPalAuthorizeBaseUrl,
  type PayPalEnvironment,
} from './environment';
import { configurationIncomplete, PAYPAL_ERROR_CODES } from './errors';
import {
  buildAuthorizeUrl,
  DEFAULT_PAYPAL_SCOPES,
  exchangeCodeForToken,
  getPayPalOAuthConfig,
} from './oauth';
import type { PayPalMetadata } from './types';

/** Canonical callback URL the framework router emits for this connector. */
const FALLBACK_CALLBACK_PATH = '/api/connectors/oauth/callback?providerId=paypal-business';

/**
 * PayPal Business — second OAuth payment connector.
 *
 * For Curaçao tenants this is the primary payment route: Stripe
 * isn't officially available for Curaçao-based legal entities (only
 * Stripe Atlas / EU detours), but PayPal Business works directly.
 *
 * Authentication: "Log in with PayPal" (LIPP) OAuth 2.0 with
 * `openid` + `profile` + `email` + `paypalattributes` scopes. The
 * customer keeps full control of their PayPal Business account; we
 * only see name, email, payer-id, merchant attributes.
 *
 * Two framework hooks override the generic OAuth orchestrator,
 * same pattern as Stripe (step 18):
 *
 *  - `getAuthorizeUrl` builds the canonical PayPal URL — the host
 *    flips between `sandbox.paypal.com/connect` and
 *    `paypal.com/connect` based on `PAYPAL_ENVIRONMENT`.
 *  - `handleOAuthCallback` runs the Basic-auth token exchange and
 *    probes `/v1/identity/oauth2/userinfo` for metadata.
 *
 * PayPal pins `redirect_uri` to whatever the authorize call used,
 * so `getAuthorizeUrl` stashes the URL on the instance and
 * `handleOAuthCallback` echoes it back. Stripe doesn't need this
 * because its token endpoint doesn't require redirect_uri.
 */
export class PayPalConnector extends BaseConnector {
  readonly id = 'paypal-business';
  readonly category = 'payments' as const;
  readonly authMethod = 'oauth' as const;
  // Mutable shape required by `BaseConnector.availableIn: CountryCode[]`.
  availableIn: CountryCode[] = ['NL', 'CW'];

  /** Test seam — production code never sets this. */
  private readonly clientOverrides?: Pick<PayPalClientOptions, 'baseUrl' | 'fetchImpl'>;
  private readonly oauthOverrides?: {
    fetchImpl?: typeof fetch;
    tokenUrl?: string;
    /** Forces config resolution. `null` simulates missing env vars. */
    config?: { clientId: string; clientSecret: string; environment: PayPalEnvironment } | null;
  };

  /**
   * Last redirect URI passed through `getAuthorizeUrl`. PayPal pins
   * `redirect_uri` to whatever the authorize call used, so we
   * capture it during `start` and echo it back during `callback`.
   * Within a single request lifecycle on Vercel/Node this is
   * sufficient — both routes share the same Lambda instance because
   * the cookie keeps the OAuth state. If a cold start lands on a
   * different worker we fall through to a canonical reconstruction
   * (see `resolveRedirectUri`).
   */
  private lastRedirectUri?: string;

  constructor(overrides?: {
    clientOverrides?: Pick<PayPalClientOptions, 'baseUrl' | 'fetchImpl'>;
    oauthOverrides?: {
      fetchImpl?: typeof fetch;
      tokenUrl?: string;
      config?: { clientId: string; clientSecret: string; environment: PayPalEnvironment } | null;
    };
  }) {
    super();
    this.clientOverrides = overrides?.clientOverrides;
    this.oauthOverrides = overrides?.oauthOverrides;
    // The framework's generic orchestrator never reads `oauth.authorizeUrl`
    // when `getAuthorizeUrl` is overridden, but we still populate it so
    // `getConnector('paypal-business').oauth.scopes` etc. are inspectable.
    this.oauth = {
      authorizeUrl: getPayPalAuthorizeBaseUrl('sandbox'),
      tokenUrl: `${getPayPalApiBaseUrl('sandbox')}/v1/oauth2/token`,
      scopes: [...DEFAULT_PAYPAL_SCOPES],
      requiresClientSecret: true,
      pkce: false,
    };
  }

  /**
   * Resolve the OAuth config — env vars in production, override in
   * tests. Centralised so both `getAuthorizeUrl` and
   * `handleOAuthCallback` see the same values.
   */
  private resolveConfig(): {
    clientId: string;
    clientSecret: string;
    environment: PayPalEnvironment;
  } | null {
    if (this.oauthOverrides && 'config' in this.oauthOverrides) {
      return this.oauthOverrides.config ?? null;
    }
    return getPayPalOAuthConfig();
  }

  /** Whether the platform is ready to drive an OAuth handshake. */
  hasConfig(): boolean {
    return this.resolveConfig() !== null;
  }

  /**
   * Active environment — used by the debug card and the connection
   * metadata. Falls through to `sandbox` when no config is set so the
   * UI can still render a sensible "you'd be hitting the sandbox"
   * hint.
   */
  getEnvironment(): PayPalEnvironment {
    return this.resolveConfig()?.environment ?? 'sandbox';
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
      environment: config.environment,
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
        error: 'PayPal Connect not yet configured. Contact support.',
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
        environment: config.environment,
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
      return { ok: false, error: 'Failed to exchange PayPal authorization code' };
    }

    // Probe userinfo for human-readable metadata. Failure here is
    // non-fatal — we already have a valid access_token, so we degrade
    // to "minimal metadata" instead of failing the whole flow.
    let metadata: PayPalMetadata = {
      environment: config.environment,
    };

    try {
      const client = new PayPalClient({
        accessToken: tokens.access_token,
        environment: config.environment,
        timeoutMs: 5_000,
        ...this.clientOverrides,
      });
      const info = await client.getUserInfo();
      metadata = {
        user_id: info.user_id,
        payer_id: info.payer_id,
        // PayPal sometimes returns the full email-style display name
        // and sometimes just the merchant business name. Either is
        // fine for the connection card.
        name: info.name ?? info.email ?? info.user_id,
        email: info.email,
        email_verified: info.email_verified,
        environment: config.environment,
        account_country: info.address?.country_code,
      };
    } catch {
      // Swallow: metadata is "best-effort" enrichment.
    }

    const credentials: Record<string, string> = {
      access_token: tokens.access_token,
    };
    if (tokens.refresh_token) credentials.refresh_token = tokens.refresh_token;
    if (tokens.expires_in) {
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1_000).toISOString();
      credentials.expires_at = expiresAt;
    }

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
export { PAYPAL_ERROR_CODES };

export const paypalConnector: ConnectorDefinition = new PayPalConnector();
