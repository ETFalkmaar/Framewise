import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureChecklistForTenant, getTemplatesForTenant } from '@/lib/checklist';
import { checklistRepo, resetStore } from '@/lib/data';

const VILLA = '11111111-1111-1111-1111-111111111111';
const RESTAURANT = '22222222-2222-2222-2222-222222222222';
const UNKNOWN = '00000000-0000-0000-0000-000000000000';

beforeEach(() => resetStore());
afterEach(() => resetStore());

describe('checklist generator', () => {
  it('returns the templates that match the tenant country + plan', async () => {
    const villa = await getTemplatesForTenant(VILLA);
    expect(villa.every((t) => t.country === 'CW')).toBe(true);
    expect(villa.length).toBeGreaterThan(0);

    const restaurant = await getTemplatesForTenant(RESTAURANT);
    expect(restaurant.every((t) => t.country === 'NL')).toBe(true);
  });

  it('returns [] for an unknown tenant', async () => {
    expect(await getTemplatesForTenant(UNKNOWN)).toEqual([]);
  });

  it('ensures one status row per applicable template (idempotent)', async () => {
    await ensureChecklistForTenant(VILLA);
    const after = await checklistRepo.getTenantStatus(VILLA);
    const expected = await getTemplatesForTenant(VILLA);
    expect(after.length).toBe(expected.length);
    const ids = new Set(after.map((r) => r.checklist_item_id));
    for (const t of expected) {
      expect(ids.has(t.id)).toBe(true);
    }

    // Running again should not add duplicates.
    await ensureChecklistForTenant(VILLA);
    const second = await checklistRepo.getTenantStatus(VILLA);
    expect(second.length).toBe(expected.length);
  });

  it('preserves existing manual statuses', async () => {
    // The seed sets cw-privacy to completed for villa; ensure() must not flip it.
    await ensureChecklistForTenant(VILLA);
    const rows = await checklistRepo.getTenantStatus(VILLA);
    const privacy = rows.find((r) => r.checklist_item_id === 'cw-privacy');
    expect(privacy?.status).toBe('completed');
  });

  it('uses string template ids on tenant_checklist_status rows', async () => {
    await ensureChecklistForTenant(VILLA);
    const rows = await checklistRepo.getTenantStatus(VILLA);
    expect(
      rows.every(
        (r) => r.checklist_item_id.startsWith('cw-') || r.checklist_item_id.startsWith('nl-')
      )
    ).toBe(true);
  });
});
