// IMPORTANT: import from the internal modules, not from the
// `@/lib/connectors` barrel. The barrel pulls this connector's
// `./index.ts` back in, causing a circular dependency that left
// `moneybirdConnector` undefined at module-load time.
import { BaseConnector } from '../../base';
import { ConnectorError, InvalidCredentialsError } from '../../errors';
import type { ConnectorContext, ConnectorDefinition, TestConnectionResult } from '../../types';

import { MoneybirdClient, type MoneybirdClientOptions } from './client';
import type { MoneybirdMetadata } from './types';

/**
 * Moneybird connector — Dutch accounting (zzp + MKB).
 *
 * Authentication: personal access token. The user creates one via
 * Moneybird → Settings → Developers → API tokens, then pastes it
 * into the framework's API-key wizard. We optionally accept an
 * `administration_id` so multi-administration tokens know which
 * scope to use; absent, the first administration the token can see
 * becomes the primary.
 *
 * `testConnection` is the minimum-viable contract: a single
 * `GET /administrations.json` proves the token works AND returns
 * metadata (administration name, count) we cache on
 * `provider_connections.metadata` so the UI can render
 * "Connected to Mijn Bedrijf BV" without ever decrypting the token.
 */
export class MoneybirdConnector extends BaseConnector {
  readonly id = 'moneybird';
  readonly category = 'accounting' as const;
  readonly authMethod = 'api_key' as const;
  // BaseConnector declares `availableIn?: CountryCode[]`; we widen to a
  // mutable array to match. The freeze in the constructor prevents
  // accidental mutation by callers.
  availableIn: ['NL'] = ['NL'];

  /**
   * Override for tests: lets us inject a stubbed `fetch`. Production
   * code never sets this; the client uses `globalThis.fetch`.
   */
  private readonly clientOverrides?: Pick<MoneybirdClientOptions, 'baseUrl' | 'fetchImpl'>;

  constructor(overrides?: Pick<MoneybirdClientOptions, 'baseUrl' | 'fetchImpl'>) {
    super();
    this.clientOverrides = overrides;
    this.apiKey = {
      instructions: {
        nl: 'Ga naar Moneybird → Instellingen → Ontwikkelaars → API tokens. Klik "Nieuw toegangstoken aanmaken" en kopieer de token hieronder. Het Administratie ID is optioneel — laat leeg om je eerste administratie te gebruiken.',
        fr: "Allez dans Moneybird → Paramètres → Développeurs → API tokens. Cliquez « Créer un nouveau token » et collez-le ci-dessous. L'ID d'administration est optionnel — laissez vide pour utiliser votre première administration.",
        en: 'Go to Moneybird → Settings → Developers → API tokens. Click "Create new access token" and paste it below. The administration ID is optional — leave it blank to use your first administration.',
      },
      fields: [
        {
          key: 'access_token',
          label: {
            nl: 'Persoonlijk toegangstoken',
            fr: "Token d'accès personnel",
            en: 'Personal access token',
          },
          type: 'password',
          required: true,
          placeholder: 'mb_…',
          validation: { minLength: 20, maxLength: 500 },
        },
        {
          key: 'administration_id',
          label: {
            nl: 'Administratie ID (optioneel)',
            fr: "ID d'administration (optionnel)",
            en: 'Administration ID (optional)',
          },
          type: 'text',
          required: false,
          placeholder: '123456789012345',
          validation: { pattern: '^\\d{6,18}$' },
        },
      ],
      helpUrl: 'https://developer.moneybird.com/authentication/',
    };
  }

  override async testConnection(
    credentials: Record<string, string>,
    _context: ConnectorContext
  ): Promise<TestConnectionResult> {
    if (!credentials.access_token) {
      return { ok: false, error: 'access_token is required' };
    }

    try {
      const client = new MoneybirdClient({
        accessToken: credentials.access_token,
        timeoutMs: 5_000,
        ...this.clientOverrides,
      });
      const administrations = await client.listAdministrations();

      if (administrations.length === 0) {
        return {
          ok: false,
          error: 'Token is valid but has no administrations attached to it.',
        };
      }

      // Default to the first administration when the user didn't pin one.
      const wantedId = credentials.administration_id?.trim();
      const primary = wantedId
        ? administrations.find((a) => a.id === wantedId)
        : administrations[0];

      if (!primary) {
        return {
          ok: false,
          error: `Administration ${wantedId} not visible to this token (token sees ${administrations.length}).`,
        };
      }

      const metadata: MoneybirdMetadata = {
        primary_administration_id: primary.id,
        primary_administration_name: primary.name,
        administrations_count: administrations.length,
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
        error: err instanceof Error ? err.message : 'Unable to connect to Moneybird',
      };
    }
  }
}

// Type-narrowing helper so the framework treats this concrete class
// as a `ConnectorDefinition` literal (it is — `BaseConnector`
// implements the interface).
export const moneybirdConnector: ConnectorDefinition = new MoneybirdConnector();
