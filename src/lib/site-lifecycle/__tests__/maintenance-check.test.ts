import { describe, expect, it } from 'vitest';

import type { Tenant, TenantStatus } from '@/types/database';

import { getRenderDecisionForTenant, shouldBypassMaintenance } from '../maintenance-check';

function makeTenant(status: TenantStatus): Tenant {
  return {
    id: 't-1',
    slug: 'demo',
    name: 'Demo',
    country: 'NL',
    vat_number: null,
    crib_number: null,
    subscription_plan_id: 'plan-1',
    status,
    custom_domain: null,
    default_locale: 'nl',
    enabled_locales: ['nl'],
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
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('getRenderDecisionForTenant', () => {
  it('returns "public" for a live tenant', () => {
    expect(getRenderDecisionForTenant(makeTenant('live'))).toEqual({ render: 'public' });
  });

  it('returns "maintenance" for an onboarding tenant', () => {
    expect(getRenderDecisionForTenant(makeTenant('onboarding'))).toEqual({
      render: 'maintenance',
    });
  });

  it('returns "maintenance" for a paused tenant (unpublished)', () => {
    expect(getRenderDecisionForTenant(makeTenant('paused'))).toEqual({
      render: 'maintenance',
    });
  });

  it('returns "404" for a cancelled tenant', () => {
    expect(getRenderDecisionForTenant(makeTenant('cancelled'))).toEqual({ render: '404' });
  });
});

describe('shouldBypassMaintenance', () => {
  it('returns true for the super-admin when status is maintenance', () => {
    expect(shouldBypassMaintenance({ render: 'maintenance' }, true)).toBe(true);
  });

  it('returns false for a regular visitor when status is maintenance', () => {
    expect(shouldBypassMaintenance({ render: 'maintenance' }, false)).toBe(false);
  });

  it('returns false when render is already public regardless of admin', () => {
    expect(shouldBypassMaintenance({ render: 'public' }, true)).toBe(false);
    expect(shouldBypassMaintenance({ render: 'public' }, false)).toBe(false);
  });

  it('returns false when render is 404 — admins should also see the 404', () => {
    expect(shouldBypassMaintenance({ render: '404' }, true)).toBe(false);
  });
});
