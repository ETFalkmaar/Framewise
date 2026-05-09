import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeChecklistProgress } from '@/lib/checklist';
import { checklistRepo, connectionsRepo, resetStore, tenantsRepo } from '@/lib/data';

const VILLA = '11111111-1111-1111-1111-111111111111';
const RESTAURANT = '22222222-2222-2222-2222-222222222222';

beforeEach(() => resetStore());
afterEach(() => resetStore());

describe('checklist progress', () => {
  it('reports a non-zero total + percentageComplete for villa', async () => {
    const p = await computeChecklistProgress(VILLA);
    expect(p.total).toBeGreaterThan(0);
    expect(p.percentageComplete).toBeGreaterThanOrEqual(0);
    expect(p.percentageComplete).toBeLessThanOrEqual(100);
  });

  it('marks cw-domain as auto-completed because villa has a custom_domain', async () => {
    const p = await computeChecklistProgress(VILLA);
    const domain = p.items.find((i) => i.template.id === 'cw-domain');
    expect(domain?.autoCompleteResolved).toBe(true);
    expect(domain?.effectiveStatus).toBe('completed');
  });

  it('marks nl-domain as pending for restaurant (no custom_domain in seed)', async () => {
    const p = await computeChecklistProgress(RESTAURANT);
    const domain = p.items.find((i) => i.template.id === 'nl-domain');
    expect(domain?.autoCompleteResolved).toBe(false);
    expect(domain?.effectiveStatus).toBe('pending');
  });

  it('connection with status=error does NOT count as auto-completed', async () => {
    // Villa has stripe in error state — payments item should not auto-complete.
    const p = await computeChecklistProgress(VILLA);
    const payments = p.items.find((i) => i.template.id === 'cw-pro-payments');
    expect(payments?.autoCompleteResolved).toBe(false);
    expect(payments?.effectiveStatus).toBe('pending');
  });

  it('restoring a connection auto-resolves its checklist item without DB write', async () => {
    // demo-restaurant's mollie is disconnected → nl-pro-payments pending.
    const before = await computeChecklistProgress(RESTAURANT);
    const beforeItem = before.items.find((i) => i.template.id === 'nl-pro-payments');
    expect(beforeItem?.effectiveStatus).toBe('pending');

    const restaurantConns = await connectionsRepo.listByTenant(RESTAURANT);
    const mollie = restaurantConns.find((c) => c.provider === 'mollie')!;
    await connectionsRepo.update(mollie.id, { status: 'connected' });

    const after = await computeChecklistProgress(RESTAURANT);
    const afterItem = after.items.find((i) => i.template.id === 'nl-pro-payments');
    expect(afterItem?.autoCompleteResolved).toBe(true);
    expect(afterItem?.effectiveStatus).toBe('completed');
  });

  it('skipped status counts as completed in totals', async () => {
    // Villa seed: cw-pro-stripe-atlas is skipped.
    const p = await computeChecklistProgress(VILLA);
    const stripe = p.items.find((i) => i.template.id === 'cw-pro-stripe-atlas');
    expect(stripe?.effectiveStatus).toBe('skipped');

    // The completed counter must include skipped.
    const skippedSeen = p.items.filter((i) => i.effectiveStatus === 'skipped').length;
    const completedSeen = p.items.filter((i) => i.effectiveStatus === 'completed').length;
    expect(p.completed).toBe(skippedSeen + completedSeen);
  });

  it('marking every required manual item as completed pushes pendingRequired to 0', async () => {
    const p1 = await computeChecklistProgress(RESTAURANT);
    const manualRequired = p1.items.filter(
      (i) =>
        i.template.required && i.template.actionType === 'manual' && i.effectiveStatus === 'pending'
    );
    for (const item of manualRequired) {
      await checklistRepo.markCompleted(RESTAURANT, item.template.id);
    }
    const p2 = await computeChecklistProgress(RESTAURANT);
    const pendingManualRequired = p2.items.filter(
      (i) =>
        i.template.required && i.template.actionType === 'manual' && i.effectiveStatus === 'pending'
    );
    expect(pendingManualRequired).toHaveLength(0);
  });

  it('100% complete tenant reports percentageComplete=100', async () => {
    const tenant = await tenantsRepo.findById(VILLA);
    expect(tenant).toBeTruthy();
    // Force every item to completed via the repository.
    const p = await computeChecklistProgress(VILLA);
    for (const item of p.items) {
      await checklistRepo.markCompleted(VILLA, item.template.id);
    }
    const after = await computeChecklistProgress(VILLA);
    expect(after.percentageComplete).toBe(100);
    expect(after.pendingRequired).toBe(0);
  });

  it('connection in connected state auto-completes its corresponding item', async () => {
    // Villa accounting (xero) is connected → cw-accounting auto-completed.
    const p = await computeChecklistProgress(VILLA);
    const accounting = p.items.find((i) => i.template.id === 'cw-accounting');
    expect(accounting?.autoCompleteResolved).toBe(true);
    expect(accounting?.effectiveStatus).toBe('completed');
  });
});
