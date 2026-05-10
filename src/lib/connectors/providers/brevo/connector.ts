// IMPORTANT: import from internal modules — see step-15 Moneybird
// circular-dep note for the why.
import type { CountryCode } from '@/lib/countries';

import { BaseConnector } from '../../base';
import { ConnectorError, InvalidCredentialsError } from '../../errors';
import type { ConnectorContext, ConnectorDefinition, TestConnectionResult } from '../../types';

import { BrevoClient, type BrevoClientOptions } from './client';
import { BREVO_ERROR_CODES } from './errors';
import type { BrevoMetadata } from './types';

/**
 * Brevo (formerly Sendinblue) — first newsletter / email-marketing
 * connector. Internationally available (NL + CW). The free tier
 * covers 300 emails/day with unlimited contacts, so every Framewise
 * tenant can use it without a budget question.
 *
 * Authentication: customer-issued API key (no OAuth, no developer
 * registration required on Framewise's side). Brevo uses a CUSTOM
 * `api-key` header — see `client.ts`.
 *
 * `testConnection` hits `/v3/account` and surfaces:
 *  - email + display name (connection card "Connected to" line)
 *  - country (cross-checked against tenant country in future steps)
 *  - primary plan type + total credits (basis for the Free tier badge)
 *
 * No OAuth client_id/secret means no env vars and no
 * `<BrevoConfigWarning />` — the wizard is fully self-service.
 */
export class BrevoConnector extends BaseConnector {
  readonly id = 'brevo';
  readonly category = 'newsletter' as const;
  readonly authMethod = 'api_key' as const;
  // Mutable shape required by `BaseConnector.availableIn: CountryCode[]`.
  availableIn: CountryCode[] = ['NL', 'CW'];

  /** Test seam — production code never sets this. */
  private readonly clientOverrides?: Pick<BrevoClientOptions, 'baseUrl' | 'fetchImpl'>;

  constructor(overrides?: Pick<BrevoClientOptions, 'baseUrl' | 'fetchImpl'>) {
    super();
    this.clientOverrides = overrides;
    this.apiKey = {
      instructions: {
        nl: 'Open je Brevo account → SMTP & API → API Keys. Klik "Generate a new API key", geef het een naam zoals "Framewise" en kopieer de key (xkeysib-…) hieronder.',
        fr: 'Ouvrez votre compte Brevo → SMTP & API → API Keys. Cliquez « Generate a new API key », donnez-lui un nom comme « Framewise » et collez la clé (xkeysib-…) ci-dessous.',
        en: 'Open your Brevo account → SMTP & API → API Keys. Click "Generate a new API key", give it a name like "Framewise" and paste the key (xkeysib-…) below.',
      },
      fields: [
        {
          key: 'api_key',
          label: {
            nl: 'Brevo API key',
            fr: 'Clé API Brevo',
            en: 'Brevo API key',
          },
          type: 'password',
          required: true,
          placeholder: 'xkeysib-…',
          // Brevo v3 keys are `xkeysib-` + 64 hex chars + `-` + ~16
          // alphanumeric chars. We accept any reasonable length so
          // future format tweaks don't break the regex.
          validation: {
            pattern: '^xkeysib-[a-fA-F0-9]+-[a-zA-Z0-9]+$',
            minLength: 50,
            maxLength: 200,
          },
        },
      ],
      helpUrl: 'https://help.brevo.com/hc/en-us/articles/209467485',
    };
  }

  override async testConnection(
    credentials: Record<string, string>,
    _context: ConnectorContext
  ): Promise<TestConnectionResult> {
    if (!credentials.api_key) {
      return { ok: false, error: 'api_key is required' };
    }

    let client: BrevoClient;
    try {
      client = new BrevoClient({
        apiKey: credentials.api_key,
        timeoutMs: 5_000,
        ...this.clientOverrides,
      });
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid Brevo API key shape',
      };
    }

    try {
      const account = await client.getAccount();
      const primaryPlan = account.plan?.[0];
      const totalCredits = account.plan?.reduce((sum, p) => sum + (p.credits ?? 0), 0) ?? 0;
      const isFreeTier = primaryPlan?.type === 'free';

      const fullName = `${account.firstName ?? ''} ${account.lastName ?? ''}`.trim();

      const metadata: BrevoMetadata = {
        email: account.email,
        company_name: account.companyName,
        full_name: fullName.length > 0 ? fullName : undefined,
        country: account.address?.country,
        plan_type: primaryPlan?.type ?? 'unknown',
        credits_remaining: totalCredits,
        is_free_tier: isFreeTier,
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
        error: err instanceof Error ? err.message : 'Unable to connect to Brevo',
      };
    }
  }
}

/** Public error code re-export for callers reaching for `ConnectorError.code`. */
export { BREVO_ERROR_CODES };

export const brevoConnector: ConnectorDefinition = new BrevoConnector();
