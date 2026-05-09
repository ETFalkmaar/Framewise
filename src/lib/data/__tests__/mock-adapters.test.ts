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
