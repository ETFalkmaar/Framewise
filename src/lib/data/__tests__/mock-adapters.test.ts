import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  bookingsRepo,
  pagesRepo,
  resetStore,
  subscriptionsRepo,
  tableCounts,
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
    expect(counts.pages).toBe(3);
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
    expect(pages).toHaveLength(3);
    expect(pages.map((p) => p.slug)).toEqual(['home', 'accommodation', 'contact']);
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
