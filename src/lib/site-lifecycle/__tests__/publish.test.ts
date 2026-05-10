import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore, tenantsRepo } from '@/lib/data';

import { publishSite, unpublishSite } from '../publish';

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
// Villa seed = LodgingBusiness in CW. Its checklist has the manual
// `cw-pro-content-review` template — until that's completed
// canTenantGoLive stays false even though connectors are seeded.
const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('publishSite', () => {
  it('returns tenant_not_found for an unknown id', async () => {
    const result = await publishSite({
      tenantId: 'does-not-exist',
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('tenant_not_found');
  });

  it('returns already_live when the tenant is already live', async () => {
    // Both seed tenants start at status='live'.
    const result = await publishSite({
      tenantId: VILLA_ID,
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('already_live');
  });

  it('returns cannot_publish_cancelled for a cancelled tenant', async () => {
    await tenantsRepo.update(VILLA_ID, { status: 'live' });
    await tenantsRepo.update(VILLA_ID, { status: 'cancelled' });
    const result = await publishSite({
      tenantId: VILLA_ID,
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('cannot_publish_cancelled');
  });

  it('refuses an onboarding tenant when required items are pending', async () => {
    // Force the tenant back to onboarding so we can attempt a publish.
    await tenantsRepo.update(VILLA_ID, { status: 'paused' });
    await tenantsRepo.update(VILLA_ID, { status: 'live' });
    await tenantsRepo.update(VILLA_ID, { status: 'paused' });
    // From paused → live is allowed by the transition rule, so the
    // refuse must come from canTenantGoLive (content-review is manual
    // + not completed in seed).
    const villa = await tenantsRepo.findById(VILLA_ID);
    expect(villa?.status).toBe('paused');

    const result = await publishSite({
      tenantId: VILLA_ID,
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('required_items_pending');
    expect(result.missingChecklistItems?.length ?? 0).toBeGreaterThan(0);
  });

  it('publishes successfully from paused when all required items are completed', async () => {
    // Mark every required checklist item complete so canTenantGoLive
    // returns true. Then flip the seeded `live` tenant to `paused`
    // (allowed transition) and publish it back.
    const { checklistRepo } = await import('@/lib/data');
    const { getTemplatesForCountryAndPlan } = await import('@/lib/checklist');
    const villa = await tenantsRepo.findById(VILLA_ID);
    const templates = getTemplatesForCountryAndPlan(villa!.country, 'enterprise');
    for (const tpl of templates.filter((t) => t.required)) {
      if (tpl.autoCompleteSource.type === 'manual') {
        await checklistRepo.markCompleted(VILLA_ID, tpl.id);
      }
    }

    await tenantsRepo.update(VILLA_ID, { status: 'paused' });
    const result = await publishSite({
      tenantId: VILLA_ID,
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('live');

    const tenant = await tenantsRepo.findById(VILLA_ID);
    expect(tenant?.status).toBe('live');
  });
});

describe('unpublishSite', () => {
  it('returns tenant_not_found for an unknown id', async () => {
    const result = await unpublishSite({
      tenantId: 'does-not-exist',
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('tenant_not_found');
  });

  it('refuses when the tenant is not currently live', async () => {
    await tenantsRepo.update(VILLA_ID, { status: 'paused' });
    const result = await unpublishSite({
      tenantId: VILLA_ID,
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('not_currently_live');
  });

  it('flips a live tenant to paused', async () => {
    const result = await unpublishSite({
      tenantId: RESTAURANT_ID,
      performedByUserId: SUPER_ADMIN_ID,
    });
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('paused');

    const tenant = await tenantsRepo.findById(RESTAURANT_ID);
    expect(tenant?.status).toBe('paused');
  });

  it('captures the unpublish reason in the audit (smoke)', async () => {
    const logs: unknown[][] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args);
    };
    try {
      await unpublishSite({
        tenantId: VILLA_ID,
        performedByUserId: SUPER_ADMIN_ID,
        reason: 'deploy-broke-css',
      });
    } finally {
      console.log = originalLog;
    }
    const match = logs.find((args) => String(args[0]).includes('site_unpublished'));
    expect(match).toBeDefined();
    const payload = match?.[1] as { reason?: string } | undefined;
    expect(payload?.reason).toBe('deploy-broke-css');
  });
});
