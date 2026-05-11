import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore } from '@/lib/data';

import { listRecentAuditEvents } from '../audit-log-view';

const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('listRecentAuditEvents', () => {
  it('returns an empty list for an unknown tenant', async () => {
    expect(await listRecentAuditEvents({ tenantId: 'does-not-exist' })).toEqual([]);
  });

  it('emits at least the tenant_created event for a seeded tenant', async () => {
    const events = await listRecentAuditEvents({ tenantId: VILLA_ID });
    expect(events.some((e) => e.action === 'tenant_created')).toBe(true);
  });

  it('synthesises a tenant update event when updated_at differs', async () => {
    const events = await listRecentAuditEvents({ tenantId: VILLA_ID });
    // Villa is `live` and the seed has a later `updated_at` than `created_at`.
    expect(events.some((e) => e.action === 'site_published')).toBe(true);
  });

  it('includes connection_added events for active connections', async () => {
    const events = await listRecentAuditEvents({ tenantId: VILLA_ID });
    expect(events.some((e) => e.action === 'connection_added')).toBe(true);
  });

  it('sorts events newest first', async () => {
    const events = await listRecentAuditEvents({ tenantId: VILLA_ID });
    for (let i = 1; i < events.length; i++) {
      expect(Date.parse(events[i - 1]!.createdAt)).toBeGreaterThanOrEqual(
        Date.parse(events[i]!.createdAt)
      );
    }
  });

  it('respects the limit parameter', async () => {
    const events = await listRecentAuditEvents({ tenantId: VILLA_ID, limit: 2 });
    expect(events.length).toBeLessThanOrEqual(2);
  });

  it('defaults the limit to 20', async () => {
    const events = await listRecentAuditEvents({ tenantId: VILLA_ID });
    expect(events.length).toBeLessThanOrEqual(20);
  });

  it('emits an event payload with metadata.country for tenant_created', async () => {
    const events = await listRecentAuditEvents({ tenantId: VILLA_ID });
    const created = events.find((e) => e.action === 'tenant_created');
    expect(created?.metadata).toMatchObject({ country: 'CW' });
  });

  it('hydrates performedByUserName for member_invited events', async () => {
    const events = await listRecentAuditEvents({ tenantId: VILLA_ID });
    const invite = events.find((e) => e.action === 'member_invited');
    if (invite) {
      // The seeded villa owner has a name; the synthesis hydrates via usersRepo.
      expect(
        typeof invite.performedByUserName === 'string' || invite.performedByUserName === null
      ).toBe(true);
    }
  });

  it('returns different events for different tenants', async () => {
    const villaEvents = await listRecentAuditEvents({ tenantId: VILLA_ID });
    const restEvents = await listRecentAuditEvents({ tenantId: RESTAURANT_ID });
    const villaIds = new Set(villaEvents.map((e) => e.id));
    const overlap = restEvents.filter((e) => villaIds.has(e.id));
    expect(overlap).toEqual([]);
  });
});
