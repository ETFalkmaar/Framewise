import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { connectionsRepo, resetStore, tokenAccessLogRepo } from '@/lib/data';
import {
  __setKeyOverride,
  AccessDeniedError,
  EncryptionError,
  getToken,
  isCiphertext,
  rotateToken,
  storeToken,
  TokenNotFoundError,
  VAULT_ERROR_CODES,
  revokeToken,
} from '@/lib/vault';

const VILLA = '11111111-1111-1111-1111-111111111111';
const RESTAURANT = '22222222-2222-2222-2222-222222222222';
const OWNER = 'a0000000-0000-0000-0000-000000000002';

beforeEach(() => {
  resetStore();
  __setKeyOverride(randomBytes(32));
});

afterEach(() => {
  __setKeyOverride(null);
  resetStore();
});

async function firstVillaConnection() {
  const conns = await connectionsRepo.listByTenant(VILLA);
  return conns[0]!;
}

describe('vault storage', () => {
  it('storeToken encrypts the value and writes a write-audit row', async () => {
    const conn = await firstVillaConnection();
    const before = (await tokenAccessLogRepo.listByConnection(conn.id)).length;

    const updated = await storeToken(conn.id, 'fresh-secret-123', {
      tenantId: VILLA,
      userId: OWNER,
    });
    expect(isCiphertext(updated.encrypted_token!)).toBe(true);

    const audit = await tokenAccessLogRepo.listByConnection(conn.id);
    expect(audit.length).toBe(before + 1);
    expect(audit[0]!.action).toBe('write');
    expect(audit[0]!.success).toBe(true);
    expect(audit[0]!.user_id).toBe(OWNER);
  });

  it('getToken decrypts and writes a read-audit row', async () => {
    const conn = await firstVillaConnection();
    await storeToken(conn.id, 'super-secret', { tenantId: VILLA, userId: OWNER });

    const plaintext = await getToken(conn.id, { tenantId: VILLA, userId: OWNER });
    expect(plaintext).toBe('super-secret');

    const audit = await tokenAccessLogRepo.listByConnection(conn.id);
    const reads = audit.filter((a) => a.action === 'read');
    expect(reads.length).toBeGreaterThanOrEqual(1);
    expect(reads[0]!.success).toBe(true);
  });

  it('getToken with a foreign tenantId throws AccessDeniedError + failure audit', async () => {
    const conn = await firstVillaConnection();
    await storeToken(conn.id, 'super-secret', { tenantId: VILLA, userId: OWNER });

    let caught: unknown;
    try {
      await getToken(conn.id, { tenantId: RESTAURANT, userId: 'attacker' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AccessDeniedError);

    const audit = await tokenAccessLogRepo.listByConnection(conn.id);
    const failures = audit.filter((a) => a.action === 'read' && a.success === false);
    // The denial path logs a failure under the *attacker's* tenant id.
    const attackerLog = await tokenAccessLogRepo.listByTenant(RESTAURANT);
    const attackerOnConn = attackerLog.filter(
      (a) => a.connection_id === conn.id && a.success === false
    );
    expect(attackerOnConn.length + failures.length).toBeGreaterThanOrEqual(1);
  });

  it('getToken with no token stored throws TokenNotFoundError + failure audit', async () => {
    const conn = await firstVillaConnection();
    await connectionsRepo.update(conn.id, { encrypted_token: null });

    let caught: unknown;
    try {
      await getToken(conn.id, { tenantId: VILLA, userId: OWNER });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TokenNotFoundError);

    const audit = await tokenAccessLogRepo.listByConnection(conn.id);
    const failed = audit.filter((a) => a.action === 'read' && a.success === false);
    expect(failed.length).toBeGreaterThanOrEqual(1);
  });

  it('revokeToken clears the column, marks disconnected, audits revoke', async () => {
    const conn = await firstVillaConnection();
    await storeToken(conn.id, 'doomed', { tenantId: VILLA, userId: OWNER });

    const revoked = await revokeToken(conn.id, { tenantId: VILLA, userId: OWNER });
    expect(revoked.encrypted_token).toBeNull();
    expect(revoked.status).toBe('disconnected');

    const audit = await tokenAccessLogRepo.listByConnection(conn.id);
    const revokeLogs = audit.filter((a) => a.action === 'revoke');
    expect(revokeLogs.length).toBeGreaterThanOrEqual(1);
    expect(revokeLogs[0]!.success).toBe(true);
  });

  it('rotateToken replaces the ciphertext with a new value and audits refresh', async () => {
    const conn = await firstVillaConnection();
    const stored = await storeToken(conn.id, 'old', { tenantId: VILLA, userId: OWNER });
    const oldCipher = stored.encrypted_token;

    const rotated = await rotateToken(conn.id, 'brand-new', {
      tenantId: VILLA,
      userId: OWNER,
    });
    expect(rotated.encrypted_token).not.toBe(oldCipher);
    expect(isCiphertext(rotated.encrypted_token!)).toBe(true);

    const reread = await getToken(conn.id, { tenantId: VILLA, userId: OWNER });
    expect(reread).toBe('brand-new');

    const audit = await tokenAccessLogRepo.listByConnection(conn.id);
    expect(audit.some((a) => a.action === 'refresh' && a.success)).toBe(true);
  });

  it('encryption errors during storeToken are audited as write/false', async () => {
    const conn = await firstVillaConnection();
    __setKeyOverride(null);
    const prev = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    try {
      let caught: unknown;
      try {
        await storeToken(conn.id, 'x', { tenantId: VILLA, userId: OWNER });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(EncryptionError);
      expect((caught as EncryptionError).code).toBe(VAULT_ERROR_CODES.KEY_MISSING);

      const audit = await tokenAccessLogRepo.listByConnection(conn.id);
      const failed = audit.filter((a) => a.action === 'write' && a.success === false);
      expect(failed.length).toBeGreaterThanOrEqual(1);
    } finally {
      if (prev) process.env.TOKEN_ENCRYPTION_KEY = prev;
    }
  });
});
