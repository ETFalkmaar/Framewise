import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore, tokenAccessLogRepo } from '@/lib/data';
import { setTokenAccessLogRepo } from '@/lib/data/repositories/token-access-log';
import { listForTenant, logAccess } from '@/lib/vault';
import { mockTokenAccessLogRepo } from '@/lib/data/adapters/mock/token-access-log';

const VILLA = '11111111-1111-1111-1111-111111111111';
const CONN = 'c0000000-0000-0000-0000-000000000001';

beforeEach(() => resetStore());
afterEach(() => {
  // Restore the real mock implementation after the failure-mode test below
  // pokes a broken impl into the proxy.
  setTokenAccessLogRepo(mockTokenAccessLogRepo);
  resetStore();
});

describe('vault audit', () => {
  it('logAccess writes a row to the repository', async () => {
    const before = (await tokenAccessLogRepo.listByConnection(CONN)).length;
    const row = await logAccess({
      tenantId: VILLA,
      connectionId: CONN,
      action: 'read',
      success: true,
      userId: 'a0000000-0000-0000-0000-000000000002',
      ipAddress: '203.0.113.99',
    });
    expect(row).toBeTruthy();
    expect(row?.action).toBe('read');
    expect(row?.success).toBe(true);
    expect(row?.user_id).toBe('a0000000-0000-0000-0000-000000000002');
    expect(row?.ip_address).toBe('203.0.113.99');

    const after = await tokenAccessLogRepo.listByConnection(CONN);
    expect(after.length).toBe(before + 1);
  });

  it('logAccess defaults user_id and ip_address to null', async () => {
    const row = await logAccess({
      tenantId: VILLA,
      connectionId: CONN,
      action: 'revoke',
      success: false,
    });
    expect(row?.user_id).toBeNull();
    expect(row?.ip_address).toBeNull();
  });

  it('listForTenant returns newest-first rows scoped to the tenant', async () => {
    const rows = await listForTenant(VILLA, 50);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.timestamp.localeCompare(rows[i - 1]!.timestamp)).toBeLessThanOrEqual(0);
    }
    expect(rows.every((r) => r.tenant_id === VILLA)).toBe(true);
  });

  it('logAccess returns null and never throws if the underlying repo fails', async () => {
    setTokenAccessLogRepo({
      ...mockTokenAccessLogRepo,
      async insert() {
        throw new Error('disk on fire');
      },
    });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await logAccess({
        tenantId: VILLA,
        connectionId: CONN,
        action: 'read',
        success: true,
      });
      expect(result).toBeNull();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
