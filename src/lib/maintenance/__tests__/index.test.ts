import { describe, expect, it } from 'vitest';

import type { LocaleCode, Tenant } from '@/types/database';

import {
  hasMaintenanceBranding,
  resolveMaintenanceHeadline,
  resolveMaintenanceMessage,
} from '../index';

function makeTenant(overrides: Partial<Tenant>): Tenant {
  return {
    id: 't-1',
    slug: 'demo',
    name: 'Demo',
    country: 'NL',
    vat_number: null,
    crib_number: null,
    subscription_plan_id: 'plan-1',
    status: 'paused',
    custom_domain: null,
    default_locale: 'nl',
    enabled_locales: ['nl', 'en'],
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
    ...overrides,
  };
}

describe('resolveMaintenanceMessage', () => {
  it('returns the requested locale when present', () => {
    const tenant = makeTenant({
      maintenance_message_translations: { nl: 'Even geduld', en: 'Be right back' },
    });
    expect(resolveMaintenanceMessage(tenant, 'en')).toBe('Be right back');
  });

  it('falls back to the tenant default locale', () => {
    const tenant = makeTenant({
      maintenance_message_translations: { nl: 'Even geduld' },
    });
    expect(resolveMaintenanceMessage(tenant, 'en')).toBe('Even geduld');
  });

  it('falls back to any non-empty locale when neither requested nor default match', () => {
    const tenant = makeTenant({
      default_locale: 'fr',
      maintenance_message_translations: { en: 'Hello' },
    });
    expect(resolveMaintenanceMessage(tenant, 'nl')).toBe('Hello');
  });

  it('uses the framework default when no map is set', () => {
    const tenant = makeTenant({ maintenance_message_translations: null });
    const message = resolveMaintenanceMessage(tenant, 'nl');
    expect(message).toContain('bijgewerkt');
  });

  it('treats empty-string values as missing', () => {
    const tenant = makeTenant({
      maintenance_message_translations: { nl: '', en: 'Working on it' },
    });
    expect(resolveMaintenanceMessage(tenant, 'nl')).toBe('Working on it');
  });

  it('produces locale-specific defaults', () => {
    const tenant = makeTenant({ maintenance_message_translations: null });
    expect(resolveMaintenanceMessage(tenant, 'nl')).not.toBe(
      resolveMaintenanceMessage(tenant, 'en')
    );
  });
});

describe('resolveMaintenanceHeadline', () => {
  it.each<[LocaleCode]>([['nl'], ['fr'], ['en']])('returns a non-empty string for %s', (locale) => {
    expect(resolveMaintenanceHeadline(locale).length).toBeGreaterThan(0);
  });
});

describe('hasMaintenanceBranding', () => {
  it('returns false for a tenant with no maintenance fields set', () => {
    expect(hasMaintenanceBranding(makeTenant({}))).toBe(false);
  });

  it('returns true when a logo URL is set', () => {
    expect(
      hasMaintenanceBranding(makeTenant({ maintenance_logo_url: 'https://example.com/logo.png' }))
    ).toBe(true);
  });

  it('returns true when a contact email is set', () => {
    expect(
      hasMaintenanceBranding(makeTenant({ maintenance_contact_email: 'hello@example.com' }))
    ).toBe(true);
  });

  it('returns true when a non-empty translation is set', () => {
    expect(
      hasMaintenanceBranding(makeTenant({ maintenance_message_translations: { nl: 'Hi' } }))
    ).toBe(true);
  });

  it('returns false when translation map has only empty strings', () => {
    expect(
      hasMaintenanceBranding(makeTenant({ maintenance_message_translations: { nl: '', en: '' } }))
    ).toBe(false);
  });
});
