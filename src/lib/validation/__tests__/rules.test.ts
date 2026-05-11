import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFeature,
  assertProviderAvailable,
  assertTransition,
  canTenantGoLive,
  canTransitionTo,
  categoriesAvailableForCountry,
  checkBookingAvailability,
  getRequiredConnectionsForTenant,
  isProviderAvailable,
  tenantHasFeature,
  VALIDATION_ERROR_CODES,
  ValidationError,
} from '@/lib/validation';
import { connectionsRepo, resetStore } from '@/lib/data';
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
  og_image_url: null,
  organization_type: null,
  twitter_handle: null,
  maintenance_message_translations: null,
  maintenance_logo_url: null,
  maintenance_contact_email: null,
  publish_request_status: 'none',
  publish_requested_at: null,
  publish_requested_by_user_id: null,
  publish_approval_notes: null,
  publish_approved_at: null,
  publish_approved_by_user_id: null,
  publish_rejected_at: null,
  publish_rejected_by_user_id: null,
  bookings_enabled: false,
  booking_timezone: null,
  calendar_feed_token: null,
  ai_agent_enabled: false,
  ai_agent_id: null,
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

const VILLA = '11111111-1111-1111-1111-111111111111';
const RESTAURANT = '22222222-2222-2222-2222-222222222222';

describe('rule: categoriesAvailableForCountry', () => {
  it('returns a category for every populated entry in the NL config', () => {
    const cats = categoriesAvailableForCountry('NL').sort();
    expect(cats).toEqual(['accounting', 'crm', 'newsletter', 'payments', 'phone']);
  });

  it('returns the same set for CW (same five categories populated)', () => {
    const cats = categoriesAvailableForCountry('CW').sort();
    expect(cats).toEqual(['accounting', 'crm', 'newsletter', 'payments', 'phone']);
  });

  it('returns [] for an unknown country code', () => {
    expect(categoriesAvailableForCountry('XX' as 'NL')).toEqual([]);
  });
});

describe('rule: getRequiredConnectionsForTenant / canTenantGoLive', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('lists accounting as configured for villa, payments not in required set', async () => {
    const summary = await getRequiredConnectionsForTenant(VILLA);
    const accounting = summary.required.find((r) => r.category === 'accounting');
    expect(accounting?.isConfigured).toBe(true);
    const payments = summary.required.find((r) => r.category === 'payments');
    expect(payments).toBeUndefined();
  });

  it('villa connection-gate alone passes — checklist still has open required items', async () => {
    // Connection gate: only accounting required for CW, xero is connected.
    const summary = await getRequiredConnectionsForTenant(VILLA);
    expect(summary.allConfigured).toBe(true);

    // canGoLive combines checklist: cw-pro-content-review (required) is pending.
    const result = await canTenantGoLive(VILLA);
    expect(result.missingCategories).toEqual([]);
    expect(result.missingChecklistItems).toContain('cw-pro-content-review');
    expect(result.canGoLive).toBe(false);
  });

  it('flips villa to canGoLive=false when accounting connection breaks', async () => {
    const villaConnections = await connectionsRepo.listByTenant(VILLA);
    const xero = villaConnections.find((c) => c.provider === 'xero')!;
    await connectionsRepo.markError(xero.id, 'demo break');

    const result = await canTenantGoLive(VILLA);
    expect(result.canGoLive).toBe(false);
    expect(result.missingCategories).toEqual(['accounting']);
  });

  it('reports restaurant (NL) as blocked because mollie is disconnected', async () => {
    // NL marks both accounting and payments as requiredAtLaunch.
    // moneybird is connected, mollie is disconnected → blocked on connection gate.
    const result = await canTenantGoLive(RESTAURANT);
    expect(result.canGoLive).toBe(false);
    expect(result.missingCategories).toContain('payments');
  });

  it('reconnecting mollie unblocks the connection gate but checklist still pending', async () => {
    await connectionsRepo.create({
      tenant_id: RESTAURANT,
      category: 'payments',
      provider: 'mollie',
      status: 'connected',
      auth_method: 'api_key',
      encrypted_token: 'reconnect_token',
      metadata: {},
      expires_at: null,
    });
    const result = await canTenantGoLive(RESTAURANT);
    expect(result.missingCategories).toEqual([]);
    // Checklist still has nl-pro-content-review pending.
    expect(result.canGoLive).toBe(false);
    expect(result.missingChecklistItems).toContain('nl-pro-content-review');
  });

  it('returns canGoLive=false with a structured "not found" reason for unknown tenant', async () => {
    const result = await canTenantGoLive('00000000-0000-0000-0000-000000000000');
    expect(result.canGoLive).toBe(false);
    expect(result.reasons.some((r) => /not found/i.test(r.defaultMessage))).toBe(true);
    expect(result.reasons[0]?.key).toMatch(/canGoLive/);
  });

  it('produces empty required list when tenant id does not exist', async () => {
    const summary = await getRequiredConnectionsForTenant('00000000-0000-0000-0000-000000000000');
    expect(summary.required).toEqual([]);
    expect(summary.allConfigured).toBe(true);
  });
});

describe('rule: canTenantGoLive — checklist gating', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('marks all required manual items completed → villa is fully canGoLive', async () => {
    const goLiveBefore = await canTenantGoLive(VILLA);
    expect(goLiveBefore.canGoLive).toBe(false);

    // Mark every required pending item as completed.
    const { checklistRepo } = await import('@/lib/data');
    const { computeChecklistProgress } = await import('@/lib/checklist');
    const progress = await computeChecklistProgress(VILLA);
    for (const item of progress.items) {
      if (item.template.required && item.effectiveStatus === 'pending') {
        await checklistRepo.markCompleted(VILLA, item.template.id);
      }
    }

    const goLiveAfter = await canTenantGoLive(VILLA);
    expect(goLiveAfter.canGoLive).toBe(true);
    expect(goLiveAfter.missingChecklistItems).toEqual([]);
  });

  it('skipping an required item also satisfies the gate', async () => {
    const { checklistRepo } = await import('@/lib/data');
    const { computeChecklistProgress } = await import('@/lib/checklist');
    const progress = await computeChecklistProgress(VILLA);
    for (const item of progress.items) {
      if (item.template.required && item.effectiveStatus === 'pending') {
        await checklistRepo.markSkipped(VILLA, item.template.id, 'demo skip');
      }
    }

    const result = await canTenantGoLive(VILLA);
    expect(result.canGoLive).toBe(true);
  });

  it('reasons include a key per missing item so the UI can translate', async () => {
    const result = await canTenantGoLive(RESTAURANT);
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const r of result.reasons) {
      expect(r.key).toMatch(/^canGoLive\./);
      expect(r.defaultMessage.length).toBeGreaterThan(0);
    }
  });
});
