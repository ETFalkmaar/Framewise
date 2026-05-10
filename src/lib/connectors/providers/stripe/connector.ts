// IMPORTANT: import from internal modules — see step-15 Moneybird
// circular-dep note for the why.
import type { CountryCode } from '@/lib/countries';

import { BaseConnector } from '../../base';
import { ConnectorError, InvalidCredentialsError } from '../../errors';
import type { ConnectorContext, ConnectorDefinition, OAuthCallbackResult } from '../../types';

import { StripeClient, type StripeClientOptions } from './client';
import { configurationIncomplete, STRIPE_ERROR_CODES } from './errors';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getStripeOAuthConfig,
  STRIPE_AUTHORIZE_URL,
  STRIPE_TOKEN_URL,
} from './oauth';
import type { StripeMetadata } from './types';

/**
 * Stripe Connect — first OAuth connector.
 *
 * Standard accounts: the customer keeps a full Stripe Dashboard,
 * payouts land on their own bank, and they pay their own Stripe fees.
 * Framewise's role is the Connect platform — we only need a
 * `read_write` access token plus the connected `acct_xxx` to drive
 * payment intents on the customer's behalf later.
 *
 * Two framework hooks override the generic OAuth orchestrator:
 *
 *  - `getAuthorizeUrl` builds the canonical Stripe URL with the
 *    real `client_id` from env vars (the framework's generic builder
 *    only knows about `framewise-<id>` placeholders).
 *  - `handleOAuthCallback` runs the actual token exchange against
 *    `connect.stripe.com/oauth/token` and probes `/v1/account` to
 *    surface useful metadata (livemode, country, business name).
 *
 * Without `STRIPE_CLIENT_ID` + `STRIPE_SECRET_KEY` the wizard still
 * renders but both hooks return a `CONFIGURATION_INCOMPLETE` error
 * so the UI can show a friendly banner — the rest of the app keeps
 * working.
 */
export class StripeConnector extends BaseConnector {
  readonly id = 'stripe';
  readonly category = 'payments' as const;
  readonly authMethod = 'oauth' as const;
  // Mutable shape required by `BaseConnector.availableIn: CountryCode[]`.
  availableIn: CountryCode[] = ['NL', 'CW'];

  /** Test seam — production code never sets this. */
  private readonly clientOverrides?: Pick<StripeClientOptions, 'baseUrl' | 'fetchImpl'>;
  private readonly oauthOverrides?: {
    fetchImpl?: typeof fetch;
    tokenUrl?: string;
    /** Forces `getStripeOAuthConfig()` to return this instead of reading env. */
    config?: { clientId: string; secretKey: string } | null;
  };

  constructor(overrides?: {
    clientOverrides?: Pick<StripeClientOptions, 'baseUrl' | 'fetchImpl'>;
    oauthOverrides?: {
      fetchImpl?: typeof fetch;
      tokenUrl?: string;
      config?: { clientId: string; secretKey: string } | null;
    };
  }) {
    super();
    this.clientOverrides = overrides?.clientOverrides;
    this.oauthOverrides = overrides?.oauthOverrides;
    this.oauth = {
      authorizeUrl: STRIPE_AUTHORIZE_URL,
      tokenUrl: STRIPE_TOKEN_URL,
      scopes: ['read_write'],
      requiresClientSecret: true,
      pkce: false,
    };
  }

  /**
   * Resolve the OAuth config — env vars in production, override in
   * tests. Centralised so both `getAuthorizeUrl` and
   * `handleOAuthCallback` see the same values.
   */
  private resolveConfig(): { clientId: string; secretKey: string } | null {
    if (this.oauthOverrides && 'config' in this.oauthOverrides) {
      return this.oauthOverrides.config ?? null;
    }
    return getStripeOAuthConfig();
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
    return buildAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: input.callbackUrl,
      state: input.state,
      scope: 'read_write',
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
        error: 'Stripe Connect not yet configured. Contact support.',
      };
    }

    let tokens;
    try {
      tokens = await exchangeCodeForToken({
        code: input.code,
        secretKey: config.secretKey,
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
      return { ok: false, error: 'Failed to exchange Stripe authorization code' };
    }

    // Probe /v1/account on the connected account to derive readable
    // metadata for the connections UI. Failure here is non-fatal — we
    // already have a valid access_token, so degrade to "minimal
    // metadata" rather than failing the whole flow.
    let metadata: StripeMetadata = {
      stripe_user_id: tokens.stripe_user_id,
      livemode: tokens.livemode,
    };

    try {
      const client = new StripeClient({
        accessToken: tokens.access_token,
        timeoutMs: 5_000,
        ...this.clientOverrides,
      });
      const account = await client.getAccount();
      metadata = {
        stripe_user_id: tokens.stripe_user_id,
        account_country: account.country,
        account_currency: account.default_currency,
        business_name: account.business_profile?.name ?? account.email ?? tokens.stripe_user_id,
        livemode: tokens.livemode,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      };
    } catch {
      // Swallow: metadata is "best-effort" enrichment.
    }

    const credentials: Record<string, string> = {
      access_token: tokens.access_token,
      stripe_user_id: tokens.stripe_user_id,
    };
    if (tokens.refresh_token) credentials.refresh_token = tokens.refresh_token;

    return {
      ok: true,
      credentials,
      metadata: metadata as Record<string, unknown>,
    };
  }
}

/** Public error code re-export for callers reaching for `ConnectorError.code`. */
export { STRIPE_ERROR_CODES };

export const stripeConnector: ConnectorDefinition = new StripeConnector();
