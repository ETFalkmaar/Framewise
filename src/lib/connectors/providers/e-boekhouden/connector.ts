// IMPORTANT: import from internal modules — see step-15 Moneybird
// circular-dep note for the why.
import { BaseConnector } from '../../base';
import { ConnectorError, InvalidCredentialsError } from '../../errors';
import type { ConnectorContext, ConnectorDefinition, TestConnectionResult } from '../../types';

import { EBoekhoudenClient, type EBoekhoudenClientOptions } from './client';
import { configurationIncomplete } from './errors';
import type { EBoekhoudenMetadata } from './types';

/**
 * e-Boekhouden connector — second NL accounting provider.
 *
 * Two-token model:
 *  - Per-customer **User API Token** entered in the wizard.
 *  - Integrator **Source API Token** read from
 *    `EBOEKHOUDEN_SOURCE_API_TOKEN` (request via
 *    support@e-boekhouden.nl, ~1-2 business days).
 *
 * Without the integrator token, `testConnection` returns a friendly
 * `CONFIGURATION_INCOMPLETE` error so the wizard renders cleanly and
 * the user knows the issue is on Framewise's side, not theirs.
 *
 * `testConnection` performs a session-create + `GET /administration`
 * round-trip; the resulting administration name + VAT number land on
 * `provider_connections.metadata` so the connections card can show
 * "Connected to <admin>" without re-decrypting the token.
 */
export class EBoekhoudenConnector extends BaseConnector {
  readonly id = 'e-boekhouden';
  readonly category = 'accounting' as const;
  readonly authMethod = 'api_key' as const;
  // Mutable shape required by `BaseConnector.availableIn: CountryCode[]`
  // (see step-15 Moneybird note).
  availableIn: ['NL'] = ['NL'];

  /** Test seam — production code never sets this. */
  private readonly clientOverrides?: Pick<
    EBoekhoudenClientOptions,
    'baseUrl' | 'fetchImpl' | 'cacheKey'
  >;
  /** Test seam — overrides `process.env.EBOEKHOUDEN_SOURCE_API_TOKEN`. */
  private readonly sourceTokenOverride?: string | null;

  constructor(overrides?: {
    clientOverrides?: Pick<EBoekhoudenClientOptions, 'baseUrl' | 'fetchImpl' | 'cacheKey'>;
    sourceToken?: string | null;
  }) {
    super();
    this.clientOverrides = overrides?.clientOverrides;
    this.sourceTokenOverride = overrides?.sourceToken;

    this.apiKey = {
      instructions: {
        nl: 'Open je e-Boekhouden account → Beheer → Webkoppelingen → Beheer Webkoppelingen → "Nieuwe API koppeling toevoegen". Selecteer Framewise als applicatie en kopieer het gegenereerde User API Token hieronder.',
        fr: 'Ouvrez votre compte e-Boekhouden → Beheer → Webkoppelingen → Beheer Webkoppelingen → « Nieuwe API koppeling toevoegen ». Sélectionnez Framewise comme application et collez le User API Token ci-dessous.',
        en: 'Open your e-Boekhouden account → Beheer → Webkoppelingen → Beheer Webkoppelingen → "Nieuwe API koppeling toevoegen". Pick Framewise as the application and paste the generated User API Token below.',
      },
      fields: [
        {
          key: 'user_api_token',
          label: {
            nl: 'User API Token',
            fr: 'Token API utilisateur',
            en: 'User API Token',
          },
          type: 'password',
          required: true,
          placeholder: '40-char hex string',
          validation: { minLength: 32, maxLength: 64 },
        },
      ],
      helpUrl: 'https://api.e-boekhouden.nl/swagger/index.html',
    };
  }

  /**
   * Resolve the integrator token from the test override or
   * `process.env`. The override exists so unit tests can flip the
   * configured/not-configured state without touching `process.env`
   * across parallel vitest workers.
   */
  private resolveSourceToken(): string | null {
    if (this.sourceTokenOverride !== undefined) return this.sourceTokenOverride;
    const fromEnv = process.env.EBOEKHOUDEN_SOURCE_API_TOKEN;
    return fromEnv && fromEnv.length > 0 ? fromEnv : null;
  }

  override async testConnection(
    credentials: Record<string, string>,
    _context: ConnectorContext
  ): Promise<TestConnectionResult> {
    if (!credentials.user_api_token) {
      return { ok: false, error: 'user_api_token is required' };
    }

    const sourceToken = this.resolveSourceToken();
    if (!sourceToken) {
      const err = configurationIncomplete();
      return { ok: false, error: `${err.code}: ${err.message}` };
    }

    let client: EBoekhoudenClient | null = null;
    try {
      client = new EBoekhoudenClient({
        userApiToken: credentials.user_api_token,
        sourceApiToken: sourceToken,
        timeoutMs: 5_000,
        ...this.clientOverrides,
      });
      const admin = await client.getAdministration();
      const metadata: EBoekhoudenMetadata = {
        administration_name: admin.name,
        administration_country: admin.country,
        vat_number: admin.vatNumber,
        last_session_at: new Date().toISOString(),
      };
      return { ok: true, metadata: metadata as Record<string, unknown> };
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return { ok: false, error: err.message };
      }
      if (err instanceof ConnectorError) {
        return { ok: false, error: `${err.code}: ${err.message}` };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to connect to e-Boekhouden',
      };
    } finally {
      // Best-effort session cleanup so tests + repeated submissions don't
      // accumulate cached entries that share a process across tenants.
      try {
        await client?.endSession();
      } catch {
        /* swallowed — cleanup never fails the caller */
      }
    }
  }
}

export const eBoekhoudenConnector: ConnectorDefinition = new EBoekhoudenConnector();
