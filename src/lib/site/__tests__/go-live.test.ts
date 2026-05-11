import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { resetStore, tenantsRepo } from '@/lib/data';
import { getGoLiveCelebrationData } from '@/lib/site/go-live';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_TENANT_ID = '22222222-2222-2222-2222-222222222222';

describe('getGoLiveCelebrationData (step 48)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('returns null for an unknown tenant', async () => {
    const result = await getGoLiveCelebrationData('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('returns null when the tenant is not yet live', async () => {
    await tenantsRepo.update(RESTAURANT_TENANT_ID, { status: 'paused' });
    const result = await getGoLiveCelebrationData(RESTAURANT_TENANT_ID);
    expect(result).toBeNull();
  });

  it('returns celebration data for a live tenant with the path-prefix siteUrl', async () => {
    const result = await getGoLiveCelebrationData(VILLA_TENANT_ID);
    expect(result).not.toBeNull();
    expect(result?.siteUrl).toBe('/sites/demo-villa');
  });

  it('floors daysFromOnboarding to at least 1 (no "0 dagen" copy)', async () => {
    // Set publish_approved_at to right after the created_at so the
    // diff is tiny / negative — must still floor to 1.
    const t = await tenantsRepo.findById(RESTAURANT_TENANT_ID);
    const sameDay = new Date(t!.created_at).toISOString();
    await tenantsRepo.update(RESTAURANT_TENANT_ID, {
      publish_approved_at: sameDay,
    });
    const result = await getGoLiveCelebrationData(RESTAURANT_TENANT_ID);
    expect(result?.daysFromOnboarding).toBeGreaterThanOrEqual(1);
  });

  it('exposes custom_domain + hasCustomDomain when set', async () => {
    const t = await tenantsRepo.findById(VILLA_TENANT_ID);
    expect(t?.custom_domain).toBe('villa-bonbini.com');
    const result = await getGoLiveCelebrationData(VILLA_TENANT_ID);
    expect(result?.customDomain).toBe('villa-bonbini.com');
    expect(result?.hasCustomDomain).toBe(true);
  });

  it('hasCustomDomain is false when custom_domain is null', async () => {
    const result = await getGoLiveCelebrationData(RESTAURANT_TENANT_ID);
    // Restaurant tenant ships with custom_domain=null per seed.
    expect(result?.hasCustomDomain).toBe(false);
    expect(result?.customDomain).toBeNull();
  });
});
