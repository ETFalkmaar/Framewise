// IMPORTANT: import from internal modules — see step-15 Moneybird
// circular-dep note for the why.
import { BaseConnector } from '../../base';
import { ConnectorError, InvalidCredentialsError } from '../../errors';
import type { ConnectorContext, ConnectorDefinition, TestConnectionResult } from '../../types';

import { MollieClient, type MollieClientOptions } from './client';
import type { MollieMetadata } from './types';

/**
 * Mollie connector — first payment provider.
 *
 * Authentication: personal API key from the Mollie dashboard. Two
 * flavours:
 *  - `test_*` keys hit the sandbox; useful for demos.
 *  - `live_*` keys move real money; require KvK + bank account on
 *    the Mollie organization.
 *
 * `testConnection` does TWO endpoints in parallel:
 *  - `GET /organizations/me` — proves the key works AND surfaces the
 *    org name we cache for "Connected to <org>" rendering.
 *  - `GET /methods` — surfaces which payment methods (iDEAL, card,
 *    Bancontact, …) are activated, so the connections UI can hint at
 *    "iDEAL + card ready" without further round-trips.
 *
 * The key prefix (`test_` / `live_`) lands on
 * `provider_connections.metadata.key_type` so the UI can badge a
 * test-mode connection in orange and warn before any production
 * payment is initiated.
 */
export class MollieConnector extends BaseConnector {
  readonly id = 'mollie';
  readonly category = 'payments' as const;
  readonly authMethod = 'api_key' as const;
  // Mutable shape required by `BaseConnector.availableIn: CountryCode[]`.
  availableIn: ['NL'] = ['NL'];

  /** Test seam — production code never sets this. */
  private readonly clientOverrides?: Pick<MollieClientOptions, 'baseUrl' | 'fetchImpl'>;

  constructor(overrides?: Pick<MollieClientOptions, 'baseUrl' | 'fetchImpl'>) {
    super();
    this.clientOverrides = overrides;
    this.apiKey = {
      instructions: {
        nl: 'Open je Mollie Dashboard → Ontwikkelaars → API-keys. Kies een Live API key (begint met "live_") of Test API key (begint met "test_") en plak hem hieronder. Test keys verwerken geen echte transacties — perfect voor een demo.',
        fr: 'Ouvrez votre tableau de bord Mollie → Développeurs → Clés API. Choisissez une clé Live (commence par « live_ ») ou une clé Test (commence par « test_ ») et collez-la ci-dessous. Les clés Test ne traitent pas de vrais paiements — parfait pour une démo.',
        en: 'Open your Mollie Dashboard → Developers → API keys. Pick a Live API key (starts with "live_") or a Test API key (starts with "test_") and paste it below. Test keys never move real money — perfect for a demo.',
      },
      fields: [
        {
          key: 'api_key',
          label: {
            nl: 'Mollie API key',
            fr: 'Clé API Mollie',
            en: 'Mollie API key',
          },
          type: 'password',
          required: true,
          placeholder: 'live_…  or  test_…',
          // Mollie's keys are a 5-char prefix (`test_`/`live_`) plus
          // 30+ alphanumeric characters. The pattern catches both.
          validation: {
            pattern: '^(test|live)_[a-zA-Z0-9]{20,40}$',
            minLength: 26,
            maxLength: 50,
          },
        },
      ],
      helpUrl: 'https://docs.mollie.com/reference/v2/api-keys',
    };
  }

  override async testConnection(
    credentials: Record<string, string>,
    _context: ConnectorContext
  ): Promise<TestConnectionResult> {
    if (!credentials.api_key) {
      return { ok: false, error: 'api_key is required' };
    }

    let client: MollieClient;
    try {
      client = new MollieClient({
        apiKey: credentials.api_key,
        timeoutMs: 5_000,
        ...this.clientOverrides,
      });
    } catch (err) {
      // Constructor throws synchronously when the key is empty or
      // (for `getKeyType()` later) malformed. We surface that as a
      // user-facing error instead of letting it crash the route.
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid Mollie API key shape',
      };
    }

    let keyType: ReturnType<typeof client.getKeyType>;
    try {
      keyType = client.getKeyType();
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid Mollie API key prefix',
      };
    }

    try {
      // Two endpoints in parallel — both small responses, both required.
      const [organization, methods] = await Promise.all([
        client.getOrganization(),
        client.listMethods(),
      ]);

      const activeMethods = methods
        .filter((m) => m.status === 'activated')
        .map((m) => m.id)
        .sort();

      const metadata: MollieMetadata = {
        organization_id: organization.id,
        organization_name: organization.name,
        country: organization.address?.country,
        key_type: keyType,
        active_methods: activeMethods,
        active_methods_count: activeMethods.length,
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
        error: err instanceof Error ? err.message : 'Unable to connect to Mollie',
      };
    }
  }
}

export const mollieConnector: ConnectorDefinition = new MollieConnector();
