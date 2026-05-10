import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  mockApiKeyConnector,
  mockOAuthConnector,
  revokeCredentials,
  storeCredentials,
} from '@/lib/connectors';
import { connectionsRepo, resetStore, tokenAccessLogRepo } from '@/lib/data';
import { __setKeyOverride, decryptIfWrapped, isCiphertext } from '@/lib/vault';

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

describe('storeCredentials / revokeCredentials', () => {
  it('creates a new connection on first call and persists encrypted JSON', async () => {
    const before = (await connectionsRepo.listByTenant(VILLA)).length;

    const id = await storeCredentials(
      mockApiKeyConnector,
      { tenantId: VILLA, userId: SUPER },
      { api_key: 'plain-token', subdomain: 'demo' }
    );

    expect(id).toBeTruthy();
    const all = await connectionsRepo.listByTenant(VILLA);
    expect(all.length).toBe(before + 1);
    const created = all.find((c) => c.id === id)!;
    expect(created.provider).toBe('mock-api-key');
    expect(created.status).toBe('connected');
    expect(isCiphertext(created.encrypted_token)).toBe(true);

    const { plaintext } = decryptIfWrapped(created.encrypted_token!);
    expect(JSON.parse(plaintext)).toEqual({ api_key: 'plain-token', subdomain: 'demo' });
  });

  it('reuses an existing disconnected row when reconnecting same provider', async () => {
    const first = await storeCredentials(
      mockApiKeyConnector,
      { tenantId: VILLA, userId: SUPER },
      { api_key: 'first' }
    );
    await connectionsRepo.update(first, { status: 'disconnected', encrypted_token: null });

    const second = await storeCredentials(
      mockApiKeyConnector,
      { tenantId: VILLA, userId: SUPER },
      { api_key: 'second' }
    );

    expect(second).toBe(first);
    const after = await connectionsRepo.listByTenant(VILLA);
    const matches = after.filter((c) => c.provider === 'mock-api-key');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.status).toBe('connected');
  });

  it('rotates the token when the connection is already connected', async () => {
    const id = await storeCredentials(
      mockApiKeyConnector,
      { tenantId: VILLA, userId: SUPER },
      { api_key: 'one' }
    );
    const after1 = (await connectionsRepo.listByTenant(VILLA)).find((c) => c.id === id)!;
    const cipher1 = after1.encrypted_token;

    await storeCredentials(
      mockApiKeyConnector,
      { tenantId: VILLA, userId: SUPER },
      { api_key: 'two' }
    );
    const after2 = (await connectionsRepo.listByTenant(VILLA)).find((c) => c.id === id)!;
    expect(after2.encrypted_token).not.toBe(cipher1);
    const { plaintext } = decryptIfWrapped(after2.encrypted_token!);
    expect(JSON.parse(plaintext).api_key).toBe('two');
  });

  it('revokeCredentials clears the token, marks disconnected and audits revoke', async () => {
    const id = await storeCredentials(
      mockApiKeyConnector,
      { tenantId: VILLA, userId: SUPER },
      { api_key: 'doomed' }
    );
    await revokeCredentials(id, { tenantId: VILLA, userId: SUPER });

    const row = (await connectionsRepo.listByTenant(VILLA)).find((c) => c.id === id)!;
    expect(row.status).toBe('disconnected');
    expect(row.encrypted_token).toBeNull();

    const audit = await tokenAccessLogRepo.listByConnection(id);
    expect(audit.some((a) => a.action === 'revoke' && a.success)).toBe(true);
  });

  it('storeCredentials persists OAuth-shaped credentials too', async () => {
    const id = await storeCredentials(
      mockOAuthConnector,
      { tenantId: VILLA, userId: SUPER },
      { access_token: 'mock_oauth_token', refresh_token: 'mock_refresh' }
    );
    const row = (await connectionsRepo.listByTenant(VILLA)).find((c) => c.id === id)!;
    expect(row.provider).toBe('mock-oauth');
    expect(row.auth_method).toBe('oauth');
    const { plaintext } = decryptIfWrapped(row.encrypted_token!);
    const parsed = JSON.parse(plaintext);
    expect(parsed.access_token).toBe('mock_oauth_token');
    expect(parsed.refresh_token).toBe('mock_refresh');
  });
});
