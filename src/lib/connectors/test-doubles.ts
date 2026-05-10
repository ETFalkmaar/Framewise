import { registerConnector } from './registry';
import type { ConnectorDefinition } from './types';

/**
 * Mock OAuth connector. Exercises the full OAuth orchestration
 * end-to-end without hitting a real provider — `flows/oauth.ts` does
 * a stubbed token exchange when `connector.oauth.tokenUrl` looks
 * like the mock URL below.
 */
export const mockOAuthConnector: ConnectorDefinition = {
  id: 'mock-oauth',
  category: 'accounting',
  authMethod: 'oauth',
  developmentOnly: true,
  oauth: {
    authorizeUrl: 'https://mock.connectors.test/oauth/authorize',
    tokenUrl: 'https://mock.connectors.test/oauth/token',
    scopes: ['read', 'write'],
    requiresClientSecret: true,
    pkce: true,
  },
  async testConnection() {
    return { ok: true, metadata: { account: 'Mock Test Account' } };
  },
};

/**
 * Mock API-key connector. Two fields, the second optional, with a
 * trivial reject-on-"invalid" rule baked into `testConnection` so the
 * UI's failure path is easy to demo.
 */
export const mockApiKeyConnector: ConnectorDefinition = {
  id: 'mock-api-key',
  category: 'newsletter',
  authMethod: 'api_key',
  developmentOnly: true,
  apiKey: {
    instructions: {
      nl: 'Open je provider-dashboard, ga naar API → Tokens en kopieer het token. Plak het hieronder en klik "Verbind".',
      fr: 'Ouvrez votre tableau de bord, allez dans API → Tokens, copiez le jeton et collez-le ci-dessous puis cliquez « Connecter ».',
      en: 'Open your provider dashboard, go to API → Tokens, copy the token and paste it below, then click "Connect".',
    },
    fields: [
      {
        key: 'api_key',
        label: { nl: 'API-token', fr: 'Jeton API', en: 'API token' },
        type: 'password',
        required: true,
        placeholder: 'mb_********',
        validation: { minLength: 4, maxLength: 200 },
      },
      {
        key: 'subdomain',
        label: { nl: 'Subdomein', fr: 'Sous-domaine', en: 'Subdomain' },
        type: 'subdomain',
        required: false,
        placeholder: 'my-account',
        validation: { pattern: '^[a-z0-9-]+$', maxLength: 60 },
      },
    ],
    helpUrl: 'https://example.com/docs/api-keys',
  },
  async testConnection(credentials) {
    if (credentials.api_key === 'invalid') {
      return { ok: false, error: 'Provider rejected the supplied token (mock)' };
    }
    return {
      ok: true,
      metadata: {
        account: credentials.subdomain ? `${credentials.subdomain}.mock` : 'mock-account',
      },
    };
  },
};

// Register both at module load. Idempotent re-imports are safe (see
// `registerConnector` in `registry.ts`).
registerConnector(mockOAuthConnector);
registerConnector(mockApiKeyConnector);
