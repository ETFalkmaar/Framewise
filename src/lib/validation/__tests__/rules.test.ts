import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFeature,
  assertProviderAvailable,
  assertTransition,
  canTransitionTo,
  checkBookingAvailability,
  isProviderAvailable,
  tenantHasFeature,
  VALIDATION_ERROR_CODES,
  ValidationError,
} from '@/lib/validation';
import { resetStore } from '@/lib/data';
import type { SubscriptionPlan, Tenant } from '@/types/database';

const VILLA_ID = '11111111-1111-1111-1111-111111111111';

const fakeTenant: Tenant = {
  id: VILLA_ID,
  slug: 'demo-villa',
  name: 'Demo Villa',
  country: 'CW',
  vat_number: null,
  crib_number: null,
  subscription_plan_id: 'b0000000-0000-0000-0000-000000000001',
  status: 'live',
  custom_domain: null,
  default_locale: 'en',
  enabled_locales: ['en'],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const basicPlan: SubscriptionPlan = {
  id: 'b0000000-0000-0000-0000-000000000001',
  code: 'basic',
  name: 'Basic',
  price_monthly_cents: 4900,
  price_yearly_cents: 49000,
  currency: 'EUR',
  features: {
    blog: false,
    editor: true,
    booking: false,
    webshop: false,
    ai_agent_advanced: false,
    custom_domain: true,
    multi_language: false,
  },
  support_hours_per_year: 2,
  max_pages: 10,
  max_languages: 1,
  has_blog: false,
  has_editor: true,
  has_booking: false,
  has_webshop: false,
  has_ai_agent_advanced: false,
  created_at: '2026-01-01T00:00:00.000Z',
};

const enterprisePlan: SubscriptionPlan = {
  ...basicPlan,
  id: 'b0000000-0000-0000-0000-000000000003',
  code: 'enterprise',
  features: { ...basicPlan.features, booking: true, webshop: true, ai_agent_advanced: true },
  has_booking: true,
  has_webshop: true,
  has_ai_agent_advanced: true,
};

describe('rule: tenantHasFeature / assertFeature', () => {
  it('reports feature presence', () => {
    expect(tenantHasFeature(fakeTenant, basicPlan, 'editor')).toBe(true);
    expect(tenantHasFeature(fakeTenant, basicPlan, 'booking')).toBe(false);
    expect(tenantHasFeature(fakeTenant, enterprisePlan, 'webshop')).toBe(true);
  });

  it('throws ValidationError when feature is missing', () => {
    expect(() => assertFeature(fakeTenant, basicPlan, 'booking')).toThrow(ValidationError);
  });

  it('does not throw when feature is present', () => {
    expect(() => assertFeature(fakeTenant, enterprisePlan, 'booking')).not.toThrow();
  });
});

describe('rule: tenant status transitions', () => {
  it('allows onboarding → live', () => {
    expect(canTransitionTo('onboarding', 'live')).toBe(true);
  });

  it('allows live → paused → live', () => {
    expect(canTransitionTo('live', 'paused')).toBe(true);
    expect(canTransitionTo('paused', 'live')).toBe(true);
  });

  it('forbids cancelled → anything', () => {
    expect(canTransitionTo('cancelled', 'live')).toBe(false);
    expect(canTransitionTo('cancelled', 'paused')).toBe(false);
    expect(canTransitionTo('cancelled', 'onboarding')).toBe(false);
  });

  it('forbids onboarding → paused (must go through live)', () => {
    expect(canTransitionTo('onboarding', 'paused')).toBe(false);
  });

  it('assertTransition throws ValidationError on invalid transition', () => {
    expect(() => assertTransition('cancelled', 'live')).toThrow(ValidationError);
  });
});

describe('rule: checkBookingAvailability', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it('returns ok=true on a free range', async () => {
    const result = await checkBookingAvailability(VILLA_ID, '2026-07-15', '2026-07-22');
    expect(result.ok).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('detects conflict with seeded booking (2026-06-15 → 2026-06-22)', async () => {
    const result = await checkBookingAvailability(VILLA_ID, '2026-06-18', '2026-06-25');
    expect(result.ok).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('respects excludeBookingId so booking can update its own dates', async () => {
    const conflict = await checkBookingAvailability(VILLA_ID, '2026-06-15', '2026-06-22');
    expect(conflict.conflicts).toHaveLength(1);
    const own = await checkBookingAvailability(
      VILLA_ID,
      '2026-06-15',
      '2026-06-22',
      conflict.conflicts[0]!.id
    );
    expect(own.conflicts).toHaveLength(0);
  });

  it('reports invalid range (start after end) as not ok', async () => {
    const result = await checkBookingAvailability(VILLA_ID, '2026-09-10', '2026-09-01');
    expect(result.ok).toBe(false);
  });
});

describe('rule: assertProviderAvailable', () => {
  it('isProviderAvailable returns true for valid combinations', () => {
    expect(isProviderAvailable('mollie', 'NL')).toBe(true);
    expect(isProviderAvailable('telnyx', 'CW')).toBe(true);
    expect(isProviderAvailable('stripe', 'NL')).toBe(true);
    expect(isProviderAvailable('stripe', 'CW')).toBe(true);
  });

  it('isProviderAvailable returns false for invalid combinations or unknown ids', () => {
    expect(isProviderAvailable('mollie', 'CW')).toBe(false);
    expect(isProviderAvailable('moneybird', 'CW')).toBe(false);
    expect(isProviderAvailable('telnyx', 'NL')).toBe(false);
    expect(isProviderAvailable('does-not-exist', 'NL')).toBe(false);
  });

  it('does not throw for valid combinations', () => {
    expect(() => assertProviderAvailable('mollie', 'NL')).not.toThrow();
    expect(() => assertProviderAvailable('xero', 'CW')).not.toThrow();
  });

  it('throws PROVIDER_NOT_AVAILABLE_IN_COUNTRY when provider does not list the country', () => {
    try {
      assertProviderAvailable('mollie', 'CW');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.code).toBe(VALIDATION_ERROR_CODES.PROVIDER_NOT_AVAILABLE_IN_COUNTRY);
      expect(ve.field).toBe('provider_id');
    }
  });

  it('throws when provider id is not registered', () => {
    try {
      assertProviderAvailable('not-a-provider', 'NL');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.code).toBe(VALIDATION_ERROR_CODES.PROVIDER_NOT_AVAILABLE_IN_COUNTRY);
      expect(ve.field).toBe('provider_id');
    }
  });

  it('throws when country code is not supported', () => {
    try {
      assertProviderAvailable('mollie', 'XX' as 'NL');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.code).toBe(VALIDATION_ERROR_CODES.PROVIDER_NOT_AVAILABLE_IN_COUNTRY);
      expect(ve.field).toBe('country_code');
    }
  });
});
