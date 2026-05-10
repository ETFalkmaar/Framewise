import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  CONNECTOR_ERROR_CODES,
  ConnectorError,
  FlowAbortedError,
  StateValidationError,
  UnsupportedFlowError,
  handleOAuthCallback,
  initiateOAuthFlow,
  mockApiKeyConnector,
  mockOAuthConnector,
  packFlowState,
} from '@/lib/connectors';
import { __setKeyOverride } from '@/lib/vault';
import { connectionsRepo, resetStore, tokenAccessLogRepo } from '@/lib/data';

const VILLA = '11111111-1111-1111-1111-111111111111';
const SUPER = 'a0000000-0000-0000-0000-000000000001';
const callbackUrl = 'https://test.framewise.app/api/connectors/oauth/callback';

beforeEach(() => {
  resetStore();
  __setKeyOverride(randomBytes(32));
});
afterEach(() => {
  resetStore();
  __setKeyOverride(null);
});

describe('initiateOAuthFlow', () => {
  it('returns a well-formed authorize URL with required OAuth params', async () => {
    const result = await initiateOAuthFlow({
      connector: mockOAuthConnector,
      context: { tenantId: VILLA, userId: SUPER },
      callbackUrl,
    });
    const url = new URL(result.authorizeUrl);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(callbackUrl);
    expect(url.searchParams.get('state')).toBe(result.state);
    expect(url.searchParams.get('scope')).toContain('read');
    expect(url.searchParams.get('client_id')).toBe('framewise-mock-oauth');
  });

  it('attaches a PKCE challenge when connector.oauth.pkce is true', async () => {
    const result = await initiateOAuthFlow({
      connector: mockOAuthConnector,
      context: { tenantId: VILLA, userId: SUPER },
      callbackUrl,
    });
    const url = new URL(result.authorizeUrl);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')?.length).toBeGreaterThan(20);
  });

  it('produces a non-empty signed cookie value', async () => {
    const a = await initiateOAuthFlow({
      connector: mockOAuthConnector,
      context: { tenantId: VILLA, userId: SUPER },
      callbackUrl,
    });
    const b = await initiateOAuthFlow({
      connector: mockOAuthConnector,
      context: { tenantId: VILLA, userId: SUPER },
      callbackUrl,
    });
    expect(a.flowStateCookie.length).toBeGreaterThan(20);
    expect(a.flowStateCookie).not.toBe(b.flowStateCookie);
  });

  it('throws UnsupportedFlowError for an api_key connector', async () => {
    let caught: unknown;
    try {
      await initiateOAuthFlow({
        connector: mockApiKeyConnector,
        context: { tenantId: VILLA, userId: SUPER },
        callbackUrl,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnsupportedFlowError);
  });
});

describe('handleOAuthCallback', () => {
  it('completes the flow and creates a connection on the happy path', async () => {
    const init = await initiateOAuthFlow({
      connector: mockOAuthConnector,
      context: { tenantId: VILLA, userId: SUPER },
      callbackUrl,
    });
    const result = await handleOAuthCallback({
      state: init.state,
      code: 'mock_code_xyz',
      flowStateCookie: init.flowStateCookie,
      connector: mockOAuthConnector,
    });
    expect(result.success).toBe(true);
    expect(result.connectionId).toBeTruthy();
    expect(result.metadata?.account).toBe('Mock Test Account');

    const connections = await connectionsRepo.listByTenant(VILLA);
    const created = connections.find((c) => c.id === result.connectionId);
    expect(created?.status).toBe('connected');
    expect(created?.encrypted_token).toBeTruthy();

    // Audit row written.
    const audit = await tokenAccessLogRepo.listByConnection(result.connectionId!);
    expect(audit.some((a) => a.action === 'write' && a.success)).toBe(true);
  });

  it('throws StateValidationError when the state cookie is missing', async () => {
    const init = await initiateOAuthFlow({
      connector: mockOAuthConnector,
      context: { tenantId: VILLA, userId: SUPER },
      callbackUrl,
    });
    let caught: unknown;
    try {
      await handleOAuthCallback({
        state: init.state,
        code: 'mock_code',
        flowStateCookie: null,
        connector: mockOAuthConnector,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StateValidationError);
  });

  it('throws StateValidationError when the state query param mismatches the cookie', async () => {
    const init = await initiateOAuthFlow({
      connector: mockOAuthConnector,
      context: { tenantId: VILLA, userId: SUPER },
      callbackUrl,
    });
    let caught: unknown;
    try {
      await handleOAuthCallback({
        state: 'tampered-state',
        code: 'mock_code',
        flowStateCookie: init.flowStateCookie,
        connector: mockOAuthConnector,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StateValidationError);
  });

  it('throws StateValidationError when the cookie expired', async () => {
    const expired = packFlowState({
      tenantId: VILLA,
      userId: SUPER,
      providerId: 'mock-oauth',
      state: 'whatever',
      exp: Date.now() - 1,
    });
    let caught: unknown;
    try {
      await handleOAuthCallback({
        state: 'whatever',
        code: 'mock_code',
        flowStateCookie: expired,
        connector: mockOAuthConnector,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StateValidationError);
  });

  it('throws FlowAbortedError when no code is present', async () => {
    const init = await initiateOAuthFlow({
      connector: mockOAuthConnector,
      context: { tenantId: VILLA, userId: SUPER },
      callbackUrl,
    });
    let caught: unknown;
    try {
      await handleOAuthCallback({
        state: init.state,
        code: null,
        flowStateCookie: init.flowStateCookie,
        connector: mockOAuthConnector,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(FlowAbortedError);
  });

  it('throws TOKEN_EXCHANGE_FAILED for a non-mock token URL', async () => {
    const realConnector = {
      ...mockOAuthConnector,
      id: 'real-stub',
      oauth: { ...mockOAuthConnector.oauth!, tokenUrl: 'https://api.real.example/oauth/token' },
    };
    const init = await initiateOAuthFlow({
      connector: realConnector,
      context: { tenantId: VILLA, userId: SUPER },
      callbackUrl,
    });
    let caught: unknown;
    try {
      await handleOAuthCallback({
        state: init.state,
        code: 'real_code',
        flowStateCookie: init.flowStateCookie,
        connector: realConnector,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConnectorError);
    expect((caught as ConnectorError).code).toBe(CONNECTOR_ERROR_CODES.TOKEN_EXCHANGE_FAILED);
  });
});
