import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore } from '@/lib/data';

import {
  RECENT_TENANTS_LIMIT,
  hydrateRecentTenants,
  parseRecentTenantsCookie,
  serializeRecentTenants,
  updateRecentTenants,
} from '../recent-tenants';

const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('parseRecentTenantsCookie', () => {
  it('returns [] for null / undefined / empty input', () => {
    expect(parseRecentTenantsCookie(null)).toEqual([]);
    expect(parseRecentTenantsCookie(undefined)).toEqual([]);
    expect(parseRecentTenantsCookie('')).toEqual([]);
  });

  it('returns [] when the cookie is not valid JSON', () => {
    expect(parseRecentTenantsCookie('not-json')).toEqual([]);
  });

  it('returns [] when the JSON payload is not an array', () => {
    expect(parseRecentTenantsCookie('{"id":"x"}')).toEqual([]);
  });

  it('returns the array of ids when the payload is well-formed', () => {
    expect(parseRecentTenantsCookie(`["${VILLA_ID}","${RESTAURANT_ID}"]`)).toEqual([
      VILLA_ID,
      RESTAURANT_ID,
    ]);
  });

  it('drops non-string entries', () => {
    expect(parseRecentTenantsCookie(`["${VILLA_ID}", 42, null, "${RESTAURANT_ID}"]`)).toEqual([
      VILLA_ID,
      RESTAURANT_ID,
    ]);
  });

  it('caps the input at RECENT_TENANTS_LIMIT', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id-${i}`);
    const out = parseRecentTenantsCookie(JSON.stringify(ids));
    expect(out.length).toBeLessThanOrEqual(RECENT_TENANTS_LIMIT);
  });
});

describe('updateRecentTenants', () => {
  it('prepends a new id to an empty list', () => {
    expect(updateRecentTenants([], VILLA_ID)).toEqual([VILLA_ID]);
  });

  it('moves an existing id to the front (LRU update)', () => {
    const before = ['a', 'b', VILLA_ID, 'd'];
    const after = updateRecentTenants(before, VILLA_ID);
    expect(after[0]).toBe(VILLA_ID);
    expect(after).toEqual([VILLA_ID, 'a', 'b', 'd']);
  });

  it('does not duplicate when the same id is the head already', () => {
    const before = [VILLA_ID, 'b', 'c'];
    const after = updateRecentTenants(before, VILLA_ID);
    expect(after).toEqual([VILLA_ID, 'b', 'c']);
  });

  it('caps the resulting list at RECENT_TENANTS_LIMIT', () => {
    const before = ['a', 'b', 'c', 'd', 'e'];
    expect(updateRecentTenants(before, 'z')).toEqual(['z', 'a', 'b', 'c', 'd']);
  });

  it('returns a new array rather than mutating the input', () => {
    const before = ['a', 'b'];
    const after = updateRecentTenants(before, 'c');
    expect(before).toEqual(['a', 'b']);
    expect(after).not.toBe(before);
  });
});

describe('serializeRecentTenants', () => {
  it('round-trips through parseRecentTenantsCookie', () => {
    const ids = [VILLA_ID, RESTAURANT_ID];
    expect(parseRecentTenantsCookie(serializeRecentTenants(ids))).toEqual(ids);
  });

  it('clamps the serialised output at RECENT_TENANTS_LIMIT', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id-${i}`);
    const parsed = JSON.parse(serializeRecentTenants(ids));
    expect(parsed.length).toBe(RECENT_TENANTS_LIMIT);
  });
});

describe('hydrateRecentTenants', () => {
  it('returns [] for an empty input', async () => {
    expect(await hydrateRecentTenants([])).toEqual([]);
  });

  it('hydrates known ids in the order they were given', async () => {
    const rows = await hydrateRecentTenants([VILLA_ID, RESTAURANT_ID]);
    expect(rows.map((t) => t.id)).toEqual([VILLA_ID, RESTAURANT_ID]);
  });

  it('drops unknown ids silently', async () => {
    const rows = await hydrateRecentTenants(['does-not-exist', VILLA_ID]);
    expect(rows.map((t) => t.id)).toEqual([VILLA_ID]);
  });

  it('preserves LRU order across hydration', async () => {
    const rows = await hydrateRecentTenants([RESTAURANT_ID, VILLA_ID]);
    expect(rows[0]!.id).toBe(RESTAURANT_ID);
    expect(rows[1]!.id).toBe(VILLA_ID);
  });
});
