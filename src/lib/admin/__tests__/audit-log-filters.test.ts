import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore } from '@/lib/data';

import { listRecentAuditEvents } from '../audit-log-view';
import { DEFAULT_AUDIT_PAGE_SIZE, listFilteredAuditEvents } from '../audit-log-filters';

const VILLA_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('listFilteredAuditEvents', () => {
  it('returns every synthesised event when no filter is supplied', async () => {
    const result = await listFilteredAuditEvents({ tenantId: VILLA_ID });
    const all = await listRecentAuditEvents({ tenantId: VILLA_ID, limit: 10_000 });
    expect(result.totalCount).toBe(all.length);
    expect(result.events.length).toBeLessThanOrEqual(DEFAULT_AUDIT_PAGE_SIZE);
  });

  it('filters by date range (dateFrom only)', async () => {
    const all = await listRecentAuditEvents({ tenantId: VILLA_ID, limit: 10_000 });
    const earliest = Math.min(...all.map((e) => Date.parse(e.createdAt)));
    const dateFrom = new Date(earliest + 1);
    const result = await listFilteredAuditEvents({ tenantId: VILLA_ID, dateFrom });
    for (const e of result.events) {
      expect(Date.parse(e.createdAt)).toBeGreaterThanOrEqual(dateFrom.getTime());
    }
    expect(result.totalCount).toBeLessThan(all.length);
  });

  it('filters by date range (dateTo only)', async () => {
    const all = await listRecentAuditEvents({ tenantId: VILLA_ID, limit: 10_000 });
    const latest = Math.max(...all.map((e) => Date.parse(e.createdAt)));
    const dateTo = new Date(latest - 1);
    const result = await listFilteredAuditEvents({ tenantId: VILLA_ID, dateTo });
    for (const e of result.events) {
      expect(Date.parse(e.createdAt)).toBeLessThanOrEqual(dateTo.getTime());
    }
  });

  it('filters by a single action type', async () => {
    const result = await listFilteredAuditEvents({
      tenantId: VILLA_ID,
      actionTypes: ['tenant_created'],
    });
    expect(result.events.every((e) => e.action === 'tenant_created')).toBe(true);
    expect(result.totalCount).toBeGreaterThan(0);
  });

  it('filters by multiple action types (OR)', async () => {
    const result = await listFilteredAuditEvents({
      tenantId: VILLA_ID,
      actionTypes: ['tenant_created', 'connection_added'],
    });
    expect(
      result.events.every((e) => e.action === 'tenant_created' || e.action === 'connection_added')
    ).toBe(true);
  });

  it('filters by performedByUserId', async () => {
    const all = await listRecentAuditEvents({ tenantId: VILLA_ID, limit: 10_000 });
    const knownUserId = all.find((e) => e.performedByUserId)?.performedByUserId;
    if (!knownUserId) {
      // Seed has no user-performed events; skip without failing.
      expect(true).toBe(true);
      return;
    }
    const result = await listFilteredAuditEvents({
      tenantId: VILLA_ID,
      performedByUserId: knownUserId,
    });
    expect(result.events.every((e) => e.performedByUserId === knownUserId)).toBe(true);
  });

  it('searches case-insensitively in metadata + user name', async () => {
    const result = await listFilteredAuditEvents({
      tenantId: VILLA_ID,
      searchQuery: 'CW',
    });
    expect(result.totalCount).toBeGreaterThan(0);
    expect(
      result.events.every((e) => JSON.stringify(e.metadata).toLowerCase().includes('cw'))
    ).toBe(true);
  });

  it('combines date + action filter as AND', async () => {
    const result = await listFilteredAuditEvents({
      tenantId: VILLA_ID,
      actionTypes: ['connection_added'],
      dateFrom: new Date(0),
    });
    expect(result.events.every((e) => e.action === 'connection_added')).toBe(true);
  });

  it('sorts ascending when sortDir=asc', async () => {
    const result = await listFilteredAuditEvents({ tenantId: VILLA_ID, sortDir: 'asc' });
    for (let i = 1; i < result.events.length; i++) {
      expect(Date.parse(result.events[i - 1]!.createdAt)).toBeLessThanOrEqual(
        Date.parse(result.events[i]!.createdAt)
      );
    }
  });

  it('sorts descending by default', async () => {
    const result = await listFilteredAuditEvents({ tenantId: VILLA_ID });
    for (let i = 1; i < result.events.length; i++) {
      expect(Date.parse(result.events[i - 1]!.createdAt)).toBeGreaterThanOrEqual(
        Date.parse(result.events[i]!.createdAt)
      );
    }
  });

  it('paginates with the supplied pageSize', async () => {
    const first = await listFilteredAuditEvents({ tenantId: VILLA_ID, pageSize: 2, page: 1 });
    const second = await listFilteredAuditEvents({ tenantId: VILLA_ID, pageSize: 2, page: 2 });
    expect(first.events.length).toBe(2);
    expect(first.currentPage).toBe(1);
    expect(second.currentPage).toBe(2);
    expect(first.totalPages).toBe(Math.ceil(first.totalCount / 2));
    // No overlap between pages.
    const firstIds = new Set(first.events.map((e) => e.id));
    expect(second.events.every((e) => !firstIds.has(e.id))).toBe(true);
  });

  it('clamps `page` to the available range', async () => {
    const out = await listFilteredAuditEvents({ tenantId: VILLA_ID, pageSize: 2, page: 9999 });
    expect(out.currentPage).toBe(out.totalPages);
  });

  it('returns empty arrays + zero totals when nothing matches', async () => {
    const result = await listFilteredAuditEvents({
      tenantId: VILLA_ID,
      searchQuery: 'xx-zz-never-matches-yy-this-string',
    });
    expect(result.events).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it('returns the uniqueActionTypes that appear in the (unfiltered) feed', async () => {
    const result = await listFilteredAuditEvents({ tenantId: VILLA_ID });
    const setFromEvents = new Set(
      (await listRecentAuditEvents({ tenantId: VILLA_ID, limit: 10_000 })).map((e) => e.action)
    );
    expect(new Set(result.uniqueActionTypes)).toEqual(setFromEvents);
  });

  it('returns uniqueUsers (id + name) for events with a known user', async () => {
    const result = await listFilteredAuditEvents({ tenantId: VILLA_ID });
    for (const u of result.uniqueUsers) {
      expect(typeof u.id).toBe('string');
      expect(typeof u.name).toBe('string');
      expect(u.id.length).toBeGreaterThan(0);
      expect(u.name.length).toBeGreaterThan(0);
    }
  });

  it('uniqueUsers list is unique by id', async () => {
    const result = await listFilteredAuditEvents({ tenantId: VILLA_ID });
    const ids = result.uniqueUsers.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns the default page size 50 when none supplied', async () => {
    const result = await listFilteredAuditEvents({ tenantId: VILLA_ID });
    expect(result.pageSize).toBe(50);
  });

  it('returns an empty result for an unknown tenant', async () => {
    const result = await listFilteredAuditEvents({ tenantId: 'does-not-exist' });
    expect(result.totalCount).toBe(0);
    expect(result.events).toEqual([]);
    expect(result.uniqueActionTypes).toEqual([]);
    expect(result.uniqueUsers).toEqual([]);
  });
});
