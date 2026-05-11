import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore } from '@/lib/data';

import { listTenantsForAdmin } from '../tenant-list';

const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('listTenantsForAdmin — no filters', () => {
  it('returns every seeded tenant', async () => {
    const result = await listTenantsForAdmin();
    expect(result.totalCount).toBeGreaterThanOrEqual(2);
    expect(result.tenants.map((t) => t.id).sort()).toContain(VILLA_ID);
    expect(result.tenants.map((t) => t.id).sort()).toContain(RESTAURANT_ID);
  });

  it('returns at least one stats payload per tenant', async () => {
    const result = await listTenantsForAdmin();
    expect(result.tenants.every((t) => t.stats !== null)).toBe(true);
  });

  it('defaults to page 1 with the documented default page size', async () => {
    const result = await listTenantsForAdmin();
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(50);
  });
});

describe('listTenantsForAdmin — search', () => {
  it('matches case-insensitively on the tenant name', async () => {
    const result = await listTenantsForAdmin({ search: 'VILLA' });
    expect(result.tenants.every((t) => t.name.toLowerCase().includes('villa'))).toBe(true);
  });

  it('matches on the tenant slug', async () => {
    const result = await listTenantsForAdmin({ search: 'demo-restaurant' });
    expect(result.tenants.map((t) => t.id)).toEqual([RESTAURANT_ID]);
  });

  it('matches on the custom domain', async () => {
    const result = await listTenantsForAdmin({ search: 'villa-bonbini' });
    expect(result.tenants.map((t) => t.id)).toEqual([VILLA_ID]);
  });

  it('returns an empty list for a search that matches nothing', async () => {
    const result = await listTenantsForAdmin({ search: 'no-such-tenant-zzz' });
    expect(result.tenants).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });
});

describe('listTenantsForAdmin — filter chain', () => {
  it('filters by status', async () => {
    const result = await listTenantsForAdmin({ status: 'live' });
    expect(result.tenants.every((t) => t.status === 'live')).toBe(true);
  });

  it('filters by country', async () => {
    const result = await listTenantsForAdmin({ country: 'NL' });
    expect(result.tenants.every((t) => t.country === 'NL')).toBe(true);
  });

  it('filters by plan code', async () => {
    const result = await listTenantsForAdmin({ plan: 'enterprise' });
    expect(result.tenants.every((t) => t.planCode === 'enterprise')).toBe(true);
  });

  it('combines filters additively (status + country)', async () => {
    const result = await listTenantsForAdmin({ status: 'live', country: 'CW' });
    for (const t of result.tenants) {
      expect(t.status).toBe('live');
      expect(t.country).toBe('CW');
    }
  });

  it('treats `all` as a no-op for each filter', async () => {
    const all = await listTenantsForAdmin({
      status: 'all',
      country: 'all',
      plan: 'all',
    });
    const noFilters = await listTenantsForAdmin();
    expect(all.totalCount).toBe(noFilters.totalCount);
  });
});

describe('listTenantsForAdmin — sorting', () => {
  it('defaults to created_at desc when no sort is supplied', async () => {
    const result = await listTenantsForAdmin();
    const dates = result.tenants.map((t) => Date.parse(t.created_at));
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]!);
    }
  });

  it('sorts by name ascending', async () => {
    const result = await listTenantsForAdmin({ sortBy: 'name', sortDir: 'asc' });
    const names = result.tenants.map((t) => t.name);
    expect(names).toEqual([...names].sort());
  });

  it('sorts by name descending', async () => {
    const result = await listTenantsForAdmin({ sortBy: 'name', sortDir: 'desc' });
    const names = result.tenants.map((t) => t.name);
    expect(names).toEqual([...names].sort().reverse());
  });

  it('sorts by status using the documented order', async () => {
    const result = await listTenantsForAdmin({ sortBy: 'status', sortDir: 'asc' });
    const order = ['onboarding', 'live', 'paused', 'cancelled'];
    const indices = result.tenants.map((t) => order.indexOf(t.status));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i - 1]).toBeLessThanOrEqual(indices[i]!);
    }
  });
});

describe('listTenantsForAdmin — pagination', () => {
  it('respects pageSize', async () => {
    const result = await listTenantsForAdmin({ pageSize: 1 });
    expect(result.tenants).toHaveLength(1);
    expect(result.pageSize).toBe(1);
    expect(result.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('returns the right slice on page 2 with pageSize=1', async () => {
    const page1 = await listTenantsForAdmin({ pageSize: 1, page: 1 });
    const page2 = await listTenantsForAdmin({ pageSize: 1, page: 2 });
    expect(page1.tenants[0]?.id).not.toBe(page2.tenants[0]?.id);
  });

  it('clamps the requested page to at least 1', async () => {
    const result = await listTenantsForAdmin({ pageSize: 1, page: 0 });
    expect(result.currentPage).toBe(1);
  });

  it('reports totalPages = 1 when nothing matches', async () => {
    const result = await listTenantsForAdmin({ search: 'no-such-tenant-zzz' });
    expect(result.totalPages).toBe(1);
  });
});
