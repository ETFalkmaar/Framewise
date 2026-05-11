import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/data';

import { auditLogsRepo, resetStore } from '@/lib/data';
import { queueEmail } from '@/lib/notifications/email-stub';

const TENANT = '11111111-1111-1111-1111-111111111111';

describe('queueEmail (step 48 email-stub)', () => {
  beforeEach(() => {
    resetStore();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  it('returns { queued: true, id } with a stable shape', async () => {
    const result = await queueEmail({
      to: 'owner@example.com',
      subject: 'Test',
      body: 'Hi there',
    });
    expect(result.queued).toBe(true);
    expect(result.id).toMatch(/^mock-email-/);
  });

  it('writes an email_queued audit-log entry when tenantId is supplied', async () => {
    const beforeLogs = await auditLogsRepo.listByTenant(TENANT);
    await queueEmail({
      to: 'owner@example.com',
      subject: 'Welcome',
      body: 'Body',
      tenantId: TENANT,
      metadata: { event: 'test' },
    });
    const afterLogs = await auditLogsRepo.listByTenant(TENANT);
    expect(afterLogs.length).toBe(beforeLogs.length + 1);
    expect(afterLogs[0].action).toBe('email_queued');
    expect(afterLogs[0].performed_by_user_id).toBeNull();
    expect(afterLogs[0].metadata).toMatchObject({
      to: 'owner@example.com',
      subject: 'Welcome',
      event: 'test',
    });
  });

  it('does NOT write an audit entry when tenantId is omitted (system-wide email)', async () => {
    const beforeLogs = await auditLogsRepo.listByTenant(TENANT);
    await queueEmail({
      to: 'someone@example.com',
      subject: 'System',
      body: 'Body',
    });
    const afterLogs = await auditLogsRepo.listByTenant(TENANT);
    expect(afterLogs.length).toBe(beforeLogs.length);
  });
});
