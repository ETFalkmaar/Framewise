import { describe, expect, it } from 'vitest';
import {
  bookingInsertSchema,
  countrySchema,
  isoDateSchema,
  isoDateTimeSchema,
  pageInsertSchema,
  slugify,
  slugSchema,
  tenantInsertSchema,
  userInsertSchema,
} from '@/lib/validation';

const VALID_TENANT_INSERT = {
  slug: 'demo-villa',
  name: 'Demo Villa',
  country: 'CW' as const,
  vat_number: null,
  crib_number: '0123456789',
  subscription_plan_id: '11111111-1111-1111-1111-111111111111',
  status: 'live' as const,
  custom_domain: null,
  default_locale: 'en' as const,
  enabled_locales: ['en', 'nl', 'fr'] as const,
};

describe('helpers', () => {
  it('slugSchema accepts valid slugs', () => {
    expect(slugSchema.safeParse('demo-villa').success).toBe(true);
    expect(slugSchema.safeParse('a').success).toBe(true);
  });

  it('slugSchema rejects invalid slugs', () => {
    expect(slugSchema.safeParse('Demo-Villa').success).toBe(false);
    expect(slugSchema.safeParse('demo villa').success).toBe(false);
    expect(slugSchema.safeParse('demo--villa').success).toBe(false);
    expect(slugSchema.safeParse('').success).toBe(false);
  });

  it('slugify normalises arbitrary input to a valid slug', () => {
    const result = slugify('Demo Villa Curaçao!');
    expect(slugSchema.safeParse(result).success).toBe(true);
  });

  it('countrySchema accepts NL/CW only', () => {
    expect(countrySchema.safeParse('NL').success).toBe(true);
    expect(countrySchema.safeParse('CW').success).toBe(true);
    expect(countrySchema.safeParse('US').success).toBe(false);
  });

  it('isoDateSchema accepts YYYY-MM-DD only', () => {
    expect(isoDateSchema.safeParse('2026-06-15').success).toBe(true);
    expect(isoDateSchema.safeParse('2026/06/15').success).toBe(false);
    expect(isoDateSchema.safeParse('2026-6-15').success).toBe(false);
  });

  it('isoDateTimeSchema accepts ISO 8601 datetimes', () => {
    expect(isoDateTimeSchema.safeParse('2026-05-09T19:00:00.000Z').success).toBe(true);
    expect(isoDateTimeSchema.safeParse('2026-05-09T19:00:00Z').success).toBe(true);
    expect(isoDateTimeSchema.safeParse('2026-05-09 19:00:00').success).toBe(false);
  });
});

describe('tenantInsertSchema', () => {
  it('accepts a valid tenant insert', () => {
    expect(tenantInsertSchema.safeParse(VALID_TENANT_INSERT).success).toBe(true);
  });

  it('accepts tenant with all locales matching default', () => {
    expect(
      tenantInsertSchema.safeParse({
        ...VALID_TENANT_INSERT,
        default_locale: 'nl',
        enabled_locales: ['nl'],
      }).success
    ).toBe(true);
  });

  it('rejects when default_locale is not in enabled_locales', () => {
    const result = tenantInsertSchema.safeParse({
      ...VALID_TENANT_INSERT,
      default_locale: 'fr',
      enabled_locales: ['nl', 'en'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid slug', () => {
    expect(
      tenantInsertSchema.safeParse({ ...VALID_TENANT_INSERT, slug: 'INVALID SLUG!' }).success
    ).toBe(false);
  });

  it('rejects too short a name', () => {
    expect(tenantInsertSchema.safeParse({ ...VALID_TENANT_INSERT, name: 'a' }).success).toBe(false);
  });
});

describe('userInsertSchema', () => {
  it('accepts a valid user', () => {
    expect(
      userInsertSchema.safeParse({
        email: 'someone@example.com',
        name: 'Someone',
        avatar_url: null,
        last_login_at: null,
      }).success
    ).toBe(true);
  });

  it('lowercases email before validating', () => {
    const parsed = userInsertSchema.parse({
      email: 'MIXED@Example.COM',
      name: 'Mixed',
      avatar_url: null,
      last_login_at: null,
    });
    expect(parsed.email).toBe('mixed@example.com');
  });

  it('rejects invalid email', () => {
    expect(
      userInsertSchema.safeParse({
        email: 'not-an-email',
        name: 'Someone',
        avatar_url: null,
        last_login_at: null,
      }).success
    ).toBe(false);
  });

  it('rejects empty name', () => {
    expect(
      userInsertSchema.safeParse({
        email: 'a@b.com',
        name: '',
        avatar_url: null,
        last_login_at: null,
      }).success
    ).toBe(false);
  });
});

describe('pageInsertSchema', () => {
  const validPage = {
    tenant_id: '11111111-1111-1111-1111-111111111111',
    slug: 'home',
    status: 'draft' as const,
    parent_id: null,
    order_index: 0,
    published_at: null,
  };

  it('accepts a valid page', () => {
    expect(pageInsertSchema.safeParse(validPage).success).toBe(true);
  });

  it('rejects negative order_index', () => {
    expect(pageInsertSchema.safeParse({ ...validPage, order_index: -1 }).success).toBe(false);
  });

  it('rejects non-integer order_index', () => {
    expect(pageInsertSchema.safeParse({ ...validPage, order_index: 1.5 }).success).toBe(false);
  });

  it('rejects bad slug', () => {
    expect(pageInsertSchema.safeParse({ ...validPage, slug: 'Bad Slug' }).success).toBe(false);
  });
});

describe('bookingInsertSchema', () => {
  const validBooking = {
    tenant_id: '11111111-1111-1111-1111-111111111111',
    status: 'pending' as const,
    start_date: '2026-09-01',
    end_date: '2026-09-08',
    persons: 2,
    guest_name: 'Test Guest',
    guest_email: 'guest@example.com',
    guest_phone: null,
    total_price_cents: 100000,
    currency: 'EUR' as const,
    payment_status: 'unpaid' as const,
    payment_provider: null,
    payment_reference: null,
    notes: null,
  };

  it('accepts a valid booking', () => {
    expect(bookingInsertSchema.safeParse(validBooking).success).toBe(true);
  });

  it('rejects when start_date > end_date', () => {
    const result = bookingInsertSchema.safeParse({
      ...validBooking,
      start_date: '2026-09-10',
      end_date: '2026-09-08',
    });
    expect(result.success).toBe(false);
  });

  it('rejects 0 persons', () => {
    expect(bookingInsertSchema.safeParse({ ...validBooking, persons: 0 }).success).toBe(false);
  });

  it('rejects unsupported currency', () => {
    expect(
      bookingInsertSchema.safeParse({ ...validBooking, currency: 'GBP' as never }).success
    ).toBe(false);
  });

  it('rejects bad email', () => {
    expect(
      bookingInsertSchema.safeParse({ ...validBooking, guest_email: 'not-an-email' }).success
    ).toBe(false);
  });
});
