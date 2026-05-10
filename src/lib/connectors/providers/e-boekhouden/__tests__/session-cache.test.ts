import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __peekCachedSession,
  __resetSessionCache,
  getCachedSession,
  invalidateCachedSession,
  setCachedSession,
} from '@/lib/connectors/providers/e-boekhouden/session-cache';

beforeEach(() => {
  __resetSessionCache();
  vi.useRealTimers();
});
afterEach(() => {
  __resetSessionCache();
  vi.useRealTimers();
});

const ONE_HOUR_FROM_NOW = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe('session cache', () => {
  it('get without set returns null', () => {
    expect(getCachedSession('villa')).toBeNull();
  });

  it('round-trips a token', () => {
    setCachedSession('villa', 'sess_abc', ONE_HOUR_FROM_NOW());
    expect(getCachedSession('villa')).toBe('sess_abc');
  });

  it('returns null after expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    setCachedSession('villa', 'sess_abc', '2026-05-10T13:00:00Z');
    // Walk past the safety-margin (5 min before real expiry) — at 12:55:01
    // the cache should already be empty.
    vi.setSystemTime(new Date('2026-05-10T12:55:01Z'));
    expect(getCachedSession('villa')).toBeNull();
  });

  it('still returns the token before the 55-minute margin', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    setCachedSession('villa', 'sess_xyz', '2026-05-10T13:00:00Z');
    vi.setSystemTime(new Date('2026-05-10T12:54:00Z'));
    expect(getCachedSession('villa')).toBe('sess_xyz');
  });

  it('invalidate clears the entry', () => {
    setCachedSession('villa', 'sess_abc', ONE_HOUR_FROM_NOW());
    invalidateCachedSession('villa');
    expect(getCachedSession('villa')).toBeNull();
  });

  it('drops the entry when expires is unparseable (defensive)', () => {
    setCachedSession('villa', 'sess_abc', 'not a date');
    expect(getCachedSession('villa')).toBeNull();
    expect(__peekCachedSession('villa')).toBeUndefined();
  });

  it('isolates entries by key', () => {
    setCachedSession('villa', 'sess_villa', ONE_HOUR_FROM_NOW());
    setCachedSession('restaurant', 'sess_restaurant', ONE_HOUR_FROM_NOW());
    expect(getCachedSession('villa')).toBe('sess_villa');
    expect(getCachedSession('restaurant')).toBe('sess_restaurant');
    invalidateCachedSession('villa');
    expect(getCachedSession('villa')).toBeNull();
    expect(getCachedSession('restaurant')).toBe('sess_restaurant');
  });

  it('overwriting a key replaces the cached value', () => {
    setCachedSession('villa', 'sess_old', ONE_HOUR_FROM_NOW());
    setCachedSession('villa', 'sess_new', ONE_HOUR_FROM_NOW());
    expect(getCachedSession('villa')).toBe('sess_new');
  });
});
