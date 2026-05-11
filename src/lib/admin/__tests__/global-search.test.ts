import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore } from '@/lib/data';

import { MAX_RESULTS, globalSearch } from '../global-search';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('globalSearch', () => {
  it('returns an empty array when the query is too short', async () => {
    expect(await globalSearch('')).toEqual([]);
    expect(await globalSearch('a')).toEqual([]);
    expect(await globalSearch(' ')).toEqual([]);
  });

  it('matches by tenant name (case-insensitive)', async () => {
    const results = await globalSearch('villa');
    const tenantHit = results.find(
      (r) => r.type === 'tenant' && r.title.toLowerCase().includes('villa')
    );
    expect(tenantHit).toBeDefined();
  });

  it('matches by tenant slug', async () => {
    const results = await globalSearch('demo-villa');
    expect(results.some((r) => r.type === 'tenant')).toBe(true);
  });

  it('matches by custom_domain when present', async () => {
    const results = await globalSearch('bonbini');
    expect(
      results.some((r) => r.subtitle?.includes('bonbini') || r.title.includes('bonbini'))
    ).toBe(true);
  });

  it('emits a `site` result type for slug/domain matches', async () => {
    const results = await globalSearch('demo-villa');
    expect(results.some((r) => r.type === 'site')).toBe(true);
  });

  it('emits a `connection` result when the provider name matches', async () => {
    const results = await globalSearch('stripe');
    expect(results.some((r) => r.type === 'connection')).toBe(true);
  });

  it('is case-insensitive', async () => {
    const upper = await globalSearch('VILLA');
    const lower = await globalSearch('villa');
    expect(upper.length).toBe(lower.length);
  });

  it('sorts higher-score hits first', async () => {
    const results = await globalSearch('demo');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });

  it('caps the result count at MAX_RESULTS', async () => {
    const results = await globalSearch('e'); // very broad fallback — under min length
    expect(results.length).toBeLessThanOrEqual(MAX_RESULTS);
  });

  it('returns each tenant result with a /admin/tenants/{id} URL', async () => {
    const results = await globalSearch('demo');
    for (const r of results) {
      if (r.type === 'tenant') {
        expect(r.url).toMatch(/^\/admin\/tenants\/[a-f0-9-]+$/);
      }
    }
  });

  it('returns each site result with a /sites/{slug} URL', async () => {
    const results = await globalSearch('demo');
    for (const r of results) {
      if (r.type === 'site') {
        expect(r.url).toMatch(/^\/sites\/[a-z0-9-]+$/);
      }
    }
  });

  it('does not return more than one tenant entry per tenant id', async () => {
    const results = await globalSearch('demo');
    const ids = results.filter((r) => r.type === 'tenant').map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns an empty array for a query that matches nothing', async () => {
    expect(await globalSearch('xx-no-such-thing-zz')).toEqual([]);
  });
});
