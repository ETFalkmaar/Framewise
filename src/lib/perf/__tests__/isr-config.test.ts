import { describe, expect, it } from 'vitest';

import { ISR_REVALIDATE } from '../isr-config';

describe('ISR_REVALIDATE', () => {
  it('exposes all four documented windows', () => {
    expect(Object.keys(ISR_REVALIDATE).sort()).toEqual([
      'PUBLIC_PAGE',
      'ROBOTS',
      'SITEMAP',
      'STATIC_CONTENT',
    ]);
  });

  it('uses 60 seconds for PUBLIC_PAGE', () => {
    expect(ISR_REVALIDATE.PUBLIC_PAGE).toBe(60);
  });

  it('uses 60 seconds for SITEMAP (matches step 27)', () => {
    expect(ISR_REVALIDATE.SITEMAP).toBe(60);
  });

  it('caches ROBOTS for an hour', () => {
    expect(ISR_REVALIDATE.ROBOTS).toBe(3600);
  });

  it('caches STATIC_CONTENT (privacy/terms) for an hour', () => {
    expect(ISR_REVALIDATE.STATIC_CONTENT).toBe(3600);
  });

  it('all values are positive integers (seconds)', () => {
    for (const value of Object.values(ISR_REVALIDATE)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});
