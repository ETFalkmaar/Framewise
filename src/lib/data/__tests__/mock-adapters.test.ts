import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  bookingsRepo,
  connectionsRepo,
  pagesRepo,
  resetStore,
  subscriptionsRepo,
  tableCounts,
  tenantCountrySettingsRepo,
  tenantsRepo,
  usersRepo,
} from '@/lib/data';
import { ValidationError, VALIDATION_ERROR_CODES } from '@/lib/validation';

const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('mock data layer — seed loading', () => {
  it('loads all seeded tenants', async () => {
    const tenants = await tenantsRepo.list();
    expect(tenants).toHaveLength(2);
    expect(tenants.map((t) => t.slug).sort()).toEqual(['demo-restaurant', 'demo-villa']);
  });

  it('loads all seeded users', async () => {
    const users = await usersRepo.list();
    expect(users).toHaveLength(3);
    expect(users.find((u) => u.email === 'framewise@example.com')).toBeTruthy();
  });

  it('loads all seeded subscription plans', async () => {
    const plans = await subscriptionsRepo.listPlans();
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.code).sort()).toEqual(['basic', 'enterprise', 'pro']);
  });

  it('reports correct row counts per table', () => {
    const counts = tableCounts();
    expect(counts.tenants).toBe(2);
    expect(counts.users).toBe(3);
    expect(counts.subscription_plans).toBe(3);
    // Step 24 extends the seeds with extra demo pages (over-ons,
    // concept, restaurant home/menu/contact) for the public renderer.
    expect(counts.pages).toBe(8);
    expect(counts.bookings).toBe(2);
    expect(counts.availability).toBe(30);
    expect(counts.setup_checklist_items).toBeGreaterThanOrEqual(15);
  });
});

describe('mock data layer — tenants CRUD', () => {
  it('finds an existing tenant by id and slug', async () => {
    const byId = await tenantsRepo.findById(VILLA_ID);
    const bySlug = await tenantsRepo.findBySlug('demo-villa');
    expect(byId?.slug).toBe('demo-villa');
    expect(bySlug?.id).toBe(VILLA_ID);
  });

  it('creates a tenant with auto-generated id, created_at, updated_at', async () => {
    const created = await tenantsRepo.create({
      slug: 'fresh',
      name: 'Fresh Tenant',
      country: 'NL',
      vat_number: null,
      crib_number: null,
      subscription_plan_id: 'b0000000-0000-0000-0000-000000000001',
      status: 'onboarding',
      custom_domain: null,
      default_locale: 'nl',
      enabled_locales: ['nl'],
    });
    expect(created.id).toMatch(/^[0-9a-f]{8}-/i);
    expect(created.created_at).toBe(created.updated_at);
    expect(await tenantsRepo.findById(created.id)).toEqual(created);
  });

  it('updates updated_at when a tenant is modified', async () => {
    const before = await tenantsRepo.findById(VILLA_ID);
    expect(before).toBeTruthy();
    // Force a different timestamp by waiting one tick.
    await new Promise((r) => setTimeout(r, 5));
    const after = await tenantsRepo.update(VILLA_ID, { name: 'Updated Villa' });
    expect(after.name).toBe('Updated Villa');
    expect(after.updated_at).not.toBe(before!.updated_at);
  });

  it('throws when updating a non-existent tenant', async () => {
    await expect(tenantsRepo.update('does-not-exist', { name: 'Nope' })).rejects.toThrow();
  });

  it('deletes an existing tenant', async () => {
    await tenantsRepo.delete(RESTAURANT_ID);
    expect(await tenantsRepo.findById(RESTAURANT_ID)).toBeNull();
    expect(await tenantsRepo.list()).toHaveLength(1);
  });
});

describe('mock data layer — pages CRUD', () => {
  it('lists pages for a tenant ordered by order_index', async () => {
    const pages = await pagesRepo.listByTenant(VILLA_ID);
    // Step 24 added `over-ons` (published) + `concept` (draft) for
    // the public renderer demo. They land at order_index 3 + 99.
    expect(pages).toHaveLength(5);
    expect(pages.map((p) => p.slug)).toEqual([
      'home',
      'accommodation',
      'contact',
      'over-ons',
      'concept',
    ]);
  });

  it('creates and publishes a page', async () => {
    const created = await pagesRepo.create({
      tenant_id: VILLA_ID,
      slug: 'about',
      status: 'draft',
      parent_id: null,
      order_index: 99,
      published_at: null,
    });
    expect(created.status).toBe('draft');
    const published = await pagesRepo.publish(created.id);
    expect(published.status).toBe('published');
    expect(published.published_at).not.toBeNull();
  });

  it('generates unique IDs across many creates', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const p = await pagesRepo.create({
        tenant_id: VILLA_ID,
        slug: `bulk-${i}`,
        status: 'draft',
        parent_id: null,
        order_index: 100 + i,
        published_at: null,
      });
      ids.add(p.id);
    }
    expect(ids.size).toBe(25);
  });
});

describe('mock data layer — bookings CRUD', () => {
  it('confirms a pending booking', async () => {
    const list = await bookingsRepo.listByTenant(VILLA_ID);
    const pending = list.find((b) => b.status === 'pending');
    expect(pending).toBeTruthy();
    const confirmed = await bookingsRepo.confirm(pending!.id);
    expect(confirmed.status).toBe('confirmed');
  });

  it('cancels a booking', async () => {
    const list = await bookingsRepo.listByTenant(VILLA_ID);
    const cancelled = await bookingsRepo.cancel(list[0]!.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('exposes availability filtered by date range', async () => {
    const slots = await bookingsRepo.listAvailability(VILLA_ID, '2026-06-15', '2026-06-21');
    expect(slots).toHaveLength(7);
    expect(slots.every((s) => s.status === 'booked')).toBe(true);
  });
});

describe('mock data layer — validation enforcement', () => {
  beforeEach(() => {
    resetStore();
  });

  it('rejects an invalid tenant slug at create time', async () => {
    await expect(
      tenantsRepo.create({
        slug: 'INVALID SLUG!',
        name: 'Bad Tenant',
        country: 'NL',
        vat_number: null,
        crib_number: null,
        subscription_plan_id: 'b0000000-0000-0000-0000-000000000001',
        status: 'onboarding',
        custom_domain: null,
        default_locale: 'nl',
        enabled_locales: ['nl'],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a duplicate tenant slug with SLUG_NOT_UNIQUE', async () => {
    let caught: unknown;
    try {
      await tenantsRepo.create({
        slug: 'demo-villa',
        name: 'Clone Villa',
        country: 'NL',
        vat_number: null,
        crib_number: null,
        subscription_plan_id: 'b0000000-0000-0000-0000-000000000001',
        status: 'onboarding',
        custom_domain: null,
        default_locale: 'nl',
        enabled_locales: ['nl'],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe(VALIDATION_ERROR_CODES.SLUG_NOT_UNIQUE);
  });

  it('rejects an invalid tenant status transition', async () => {
    await tenantsRepo.update(VILLA_ID, { status: 'cancelled' });
    let caught: unknown;
    try {
      await tenantsRepo.update(VILLA_ID, { status: 'live' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe(VALIDATION_ERROR_CODES.STATUS_TRANSITION_INVALID);
  });

  it('rejects updating a non-existent tenant with NOT_FOUND', async () => {
    let caught: unknown;
    try {
      await tenantsRepo.update('00000000-0000-0000-0000-000000000000', {
        name: 'Ghost',
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe(VALIDATION_ERROR_CODES.NOT_FOUND);
  });

  it('rejects an invalid user email at create time', async () => {
    await expect(
      usersRepo.create({
        email: 'not-an-email',
        name: 'Bad',
        avatar_url: null,
        password_hash: 'Password1!',
        last_login_at: null,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a duplicate user email', async () => {
    let caught: unknown;
    try {
      await usersRepo.create({
        email: 'framewise@example.com',
        name: 'Clone',
        avatar_url: null,
        password_hash: 'Password1!',
        last_login_at: null,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe(VALIDATION_ERROR_CODES.EMAIL_NOT_UNIQUE);
  });

  it('rejects a duplicate page slug per tenant', async () => {
    let caught: unknown;
    try {
      await pagesRepo.create({
        tenant_id: VILLA_ID,
        slug: 'home',
        status: 'draft',
        parent_id: null,
        order_index: 50,
        published_at: null,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe(VALIDATION_ERROR_CODES.SLUG_NOT_UNIQUE);
  });

  it('rejects bookings that conflict with existing ones', async () => {
    let caught: unknown;
    try {
      await bookingsRepo.create({
        tenant_id: VILLA_ID,
        status: 'pending',
        // Overlap with seeded confirmed booking 2026-06-15 → 2026-06-22
        start_date: '2026-06-18',
        end_date: '2026-06-25',
        persons: 2,
        guest_name: 'Conflict Guest',
        guest_email: 'conflict@example.com',
        guest_phone: null,
        total_price_cents: 100000,
        currency: 'EUR',
        payment_status: 'unpaid',
        payment_provider: null,
        payment_reference: null,
        notes: null,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe(VALIDATION_ERROR_CODES.BOOKING_CONFLICT);
  });

  it('accepts a non-conflicting booking', async () => {
    const created = await bookingsRepo.create({
      tenant_id: VILLA_ID,
      status: 'pending',
      start_date: '2026-10-01',
      end_date: '2026-10-08',
      persons: 2,
      guest_name: 'Happy Guest',
      guest_email: 'happy@example.com',
      guest_phone: null,
      total_price_cents: 200000,
      currency: 'EUR',
      payment_status: 'unpaid',
      payment_provider: null,
      payment_reference: null,
      notes: null,
    });
    expect(created.id).toMatch(/^[0-9a-f]{8}-/i);
  });
});

describe('mock data layer — provider connections', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('loads seed rows', async () => {
    const villa = await connectionsRepo.listByTenant(VILLA_ID);
    const restaurant = await connectionsRepo.listByTenant(RESTAURANT_ID);
    expect(villa).toHaveLength(4);
    expect(restaurant).toHaveLength(3);
  });

  it('findByCategory filters by tenant + category', async () => {
    const accounting = await connectionsRepo.findByCategory(VILLA_ID, 'accounting');
    expect(accounting).toHaveLength(1);
    expect(accounting[0]!.provider).toBe('xero');

    const newsletter = await connectionsRepo.findByCategory(VILLA_ID, 'newsletter');
    expect(newsletter).toHaveLength(0);
  });

  it('findActive returns only connected rows', async () => {
    const active = await connectionsRepo.findActive(VILLA_ID);
    expect(active.every((c) => c.status === 'connected')).toBe(true);
    expect(active.map((c) => c.provider).sort()).toEqual(['hubspot', 'xero']);
  });

  it('findByProvider returns the matching row or null', async () => {
    const stripe = await connectionsRepo.findByProvider(VILLA_ID, 'stripe');
    expect(stripe?.status).toBe('error');
    const missing = await connectionsRepo.findByProvider(VILLA_ID, 'mollie');
    expect(missing).toBeNull();
  });

  it('rejects creating a connection for a provider not available in the tenant country', async () => {
    let caught: unknown;
    try {
      // mollie is NL-only; demo-villa is CW.
      await connectionsRepo.create({
        tenant_id: VILLA_ID,
        category: 'payments',
        provider: 'mollie',
        status: 'connected',
        auth_method: 'api_key',
        encrypted_token: null,
        metadata: {},
        expires_at: null,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe(
      VALIDATION_ERROR_CODES.PROVIDER_NOT_AVAILABLE_IN_COUNTRY
    );
  });

  it('reuses a disconnected row when reconnecting same provider', async () => {
    const restaurantBefore = await connectionsRepo.listByTenant(RESTAURANT_ID);
    const mollieBefore = restaurantBefore.find((c) => c.provider === 'mollie')!;
    expect(mollieBefore.status).toBe('disconnected');

    const reconnected = await connectionsRepo.create({
      tenant_id: RESTAURANT_ID,
      category: 'payments',
      provider: 'mollie',
      status: 'connected',
      auth_method: 'api_key',
      encrypted_token: 'fresh_token',
      metadata: { profile_id: 'pfl_new' },
      expires_at: null,
    });
    expect(reconnected.id).toBe(mollieBefore.id);
    expect(reconnected.status).toBe('connected');

    const restaurantAfter = await connectionsRepo.listByTenant(RESTAURANT_ID);
    expect(restaurantAfter).toHaveLength(3); // no duplicates
  });

  it('rejects creating a duplicate active connection', async () => {
    let caught: unknown;
    try {
      await connectionsRepo.create({
        tenant_id: VILLA_ID,
        category: 'accounting',
        provider: 'xero',
        status: 'connected',
        auth_method: 'oauth',
        encrypted_token: 'mock',
        metadata: {},
        expires_at: null,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
  });

  it('markExpired sets status to expired', async () => {
    const villa = await connectionsRepo.listByTenant(VILLA_ID);
    const xero = villa.find((c) => c.provider === 'xero')!;
    const expired = await connectionsRepo.markExpired(xero.id);
    expect(expired.status).toBe('expired');
    expect(expired.expires_at).not.toBeNull();
  });

  it('markError records the error message and switches status', async () => {
    const villa = await connectionsRepo.listByTenant(VILLA_ID);
    const hubspot = villa.find((c) => c.provider === 'hubspot')!;
    const errored = await connectionsRepo.markError(hubspot.id, 'token rejected');
    expect(errored.status).toBe('error');
    expect((errored.metadata as Record<string, unknown>).last_error).toBe('token rejected');
  });

  it('revoke clears the token and switches to disconnected', async () => {
    const villa = await connectionsRepo.listByTenant(VILLA_ID);
    const hubspot = villa.find((c) => c.provider === 'hubspot')!;
    const revoked = await connectionsRepo.revoke(hubspot.id);
    expect(revoked.status).toBe('disconnected');
    expect(revoked.encrypted_token).toBeNull();
    expect(revoked.last_used_at).not.toBe(hubspot.last_used_at);
  });

  it('rejects an invalid status transition', async () => {
    const restaurant = await connectionsRepo.listByTenant(RESTAURANT_ID);
    const mollie = restaurant.find((c) => c.provider === 'mollie')!; // disconnected
    let caught: unknown;
    try {
      await connectionsRepo.markError(mollie.id, 'cannot go straight to error');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe(VALIDATION_ERROR_CODES.STATUS_TRANSITION_INVALID);
  });
});

describe('mock data layer — tenant_country_settings', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('loads seed rows', async () => {
    const all = await tenantCountrySettingsRepo.list();
    expect(all).toHaveLength(2);
  });

  it('findByTenant returns the matching row', async () => {
    const villa = await tenantCountrySettingsRepo.findByTenant(VILLA_ID);
    expect(villa?.country).toBe('CW');
    expect(villa?.currency).toBe('ANG');
    expect(villa?.legal_entity_name).toBe('Villa Bonbini B.V.');
  });

  it('upsert updates an existing row in place', async () => {
    const before = await tenantCountrySettingsRepo.findByTenant(VILLA_ID);
    expect(before).toBeTruthy();

    const updated = await tenantCountrySettingsRepo.upsert({
      tenant_id: VILLA_ID,
      country: 'CW',
      currency: 'USD',
      timezone: 'America/Curacao',
      locale_default: 'en',
      legal_entity_name: 'Villa Bonbini Trading N.V.',
      address: {
        street: 'Caracasbaaiweg 1',
        city: 'Willemstad',
        postal_code: '0000',
        country: 'CW',
      },
    });
    expect(updated.id).toBe(before!.id);
    expect(updated.legal_entity_name).toBe('Villa Bonbini Trading N.V.');
    expect(updated.currency).toBe('USD');

    const all = await tenantCountrySettingsRepo.list();
    expect(all).toHaveLength(2); // still no duplicate row
  });

  it('upsert inserts a new row when none exists', async () => {
    const NEW_TENANT = '33333333-3333-3333-3333-333333333333';
    const created = await tenantCountrySettingsRepo.upsert({
      tenant_id: NEW_TENANT,
      country: 'NL',
      currency: 'EUR',
      timezone: 'Europe/Amsterdam',
      locale_default: 'nl',
      legal_entity_name: 'Fresh BV',
      address: { street: 'X 1', city: 'Amsterdam', postal_code: '1000AA', country: 'NL' },
    });
    expect(created.id).toMatch(/^[0-9a-f]{8}-/i);
    expect(await tenantCountrySettingsRepo.list()).toHaveLength(3);
  });

  it('rejects an invalid timezone', async () => {
    let caught: unknown;
    try {
      await tenantCountrySettingsRepo.upsert({
        tenant_id: VILLA_ID,
        country: 'CW',
        currency: 'ANG',
        timezone: 'NOTAVALIDZONE',
        locale_default: 'nl',
        legal_entity_name: 'X',
        address: { street: 'X', city: 'X', postal_code: '1', country: 'CW' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
  });

  it('rejects a locale not available in the country', async () => {
    let caught: unknown;
    try {
      await tenantCountrySettingsRepo.upsert({
        tenant_id: VILLA_ID,
        country: 'CW',
        currency: 'ANG',
        timezone: 'America/Curacao',
        // CW availableLocales is ['nl', 'en'] — fr is rejected
        locale_default: 'fr',
        legal_entity_name: 'X',
        address: { street: 'X 1', city: 'Willemstad', postal_code: '0000', country: 'CW' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
  });

  it('rejects a currency not supported in the country', async () => {
    let caught: unknown;
    try {
      await tenantCountrySettingsRepo.upsert({
        tenant_id: RESTAURANT_ID,
        country: 'NL',
        currency: 'ANG',
        timezone: 'Europe/Amsterdam',
        locale_default: 'nl',
        legal_entity_name: 'X',
        address: { street: 'X', city: 'A', postal_code: '1000AA', country: 'NL' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
  });

  it('delete removes the settings row', async () => {
    await tenantCountrySettingsRepo.delete(VILLA_ID);
    expect(await tenantCountrySettingsRepo.findByTenant(VILLA_ID)).toBeNull();
  });
});
