import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  CONNECTOR_ERROR_CODES,
  ConnectorError,
  InvalidCredentialsError,
  MissingFieldError,
  UnsupportedFlowError,
  mockApiKeyConnector,
  mockOAuthConnector,
  submitApiKeyCredentials,
  type ConnectorDefinition,
} from '@/lib/connectors';
import { connectionsRepo, resetStore, tokenAccessLogRepo } from '@/lib/data';
import { __setKeyOverride, isCiphertext } from '@/lib/vault';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';

beforeEach(() => {
  resetStore();
  __setKeyOverride(randomBytes(32));
});
afterEach(() => {
  resetStore();
  __setKeyOverride(null);
});

describe('submitApiKeyCredentials', () => {
  it('happy path: connection created, encrypted token stored, audit logged', async () => {
    const result = await submitApiKeyCredentials({
      connector: mockApiKeyConnector,
      credentials: { api_key: 'real_token_value', subdomain: 'demo' },
      context: { tenantId: VILLA, userId: SUPER },
    });
    expect(result.success).toBe(true);
    expect(result.connectionId).toBeTruthy();
    expect(result.metadata?.account).toBe('demo.mock');

    const connections = await connectionsRepo.listByTenant(VILLA);
    const created = connections.find((c) => c.id === result.connectionId);
    expect(created?.status).toBe('connected');
    expect(created?.provider).toBe('mock-api-key');
    expect(isCiphertext(created?.encrypted_token ?? null)).toBe(true);

    const audit = await tokenAccessLogRepo.listByConnection(result.connectionId!);
    expect(audit.some((a) => a.action === 'write' && a.success)).toBe(true);
  });

  it('strips empty optional fields before storing', async () => {
    const result = await submitApiKeyCredentials({
      connector: mockApiKeyConnector,
      credentials: { api_key: 'token', subdomain: '   ' }, // whitespace-only optional
      context: { tenantId: VILLA, userId: SUPER },
    });
    expect(result.success).toBe(true);
    expect(result.metadata?.account).toBe('mock-account'); // testConnection saw no subdomain
  });

  it('throws MissingFieldError when a required field is empty', async () => {
    let caught: unknown;
    try {
      await submitApiKeyCredentials({
        connector: mockApiKeyConnector,
        credentials: { api_key: '', subdomain: '' },
        context: { tenantId: VILLA, userId: SUPER },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MissingFieldError);
    expect((caught as MissingFieldError).code).toBe(CONNECTOR_ERROR_CODES.MISSING_FIELD);
    expect((caught as MissingFieldError).details?.fieldKey).toBe('api_key');
  });

  it('throws MissingFieldError when a field violates its validation rule', async () => {
    let caught: unknown;
    try {
      await submitApiKeyCredentials({
        connector: mockApiKeyConnector,
        credentials: { api_key: 'ok-token', subdomain: 'NOT-LOWERCASE!' },
        context: { tenantId: VILLA, userId: SUPER },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MissingFieldError);
    expect((caught as MissingFieldError).details?.fieldKey).toBe('subdomain');
  });

  it('throws InvalidCredentialsError when testConnection rejects', async () => {
    let caught: unknown;
    try {
      await submitApiKeyCredentials({
        connector: mockApiKeyConnector,
        credentials: { api_key: 'invalid' },
        context: { tenantId: VILLA, userId: SUPER },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvalidCredentialsError);
    expect((caught as ConnectorError).code).toBe(CONNECTOR_ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('throws UnsupportedFlowError when called with an oauth connector', async () => {
    let caught: unknown;
    try {
      await submitApiKeyCredentials({
        connector: mockOAuthConnector,
        credentials: { api_key: 'x' },
        context: { tenantId: VILLA, userId: SUPER },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnsupportedFlowError);
  });

  it('skips testConnection silently when the connector does not provide one', async () => {
    const noTest: ConnectorDefinition = {
      id: 'mock-no-test',
      category: 'newsletter',
      authMethod: 'api_key',
      developmentOnly: true,
      apiKey: {
        instructions: { nl: '', fr: '', en: '' },
        fields: [
          { key: 'api_key', label: { nl: '', fr: '', en: '' }, type: 'password', required: true },
        ],
      },
    };
    const result = await submitApiKeyCredentials({
      connector: noTest,
      credentials: { api_key: 'anything' },
      context: { tenantId: VILLA, userId: SUPER },
    });
    expect(result.success).toBe(true);
  });
});
