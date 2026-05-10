import { describe, expect, it } from 'vitest';

import type { ChecklistItemTemplate, ChecklistProgress, ChecklistProgressItem } from '../index';
import {
  CATEGORY_ORDER,
  allRequiredDone,
  firstPendingRequired,
  groupChecklistByCategory,
} from '../ui-helpers';

function makeTemplate(overrides: Partial<ChecklistItemTemplate>): ChecklistItemTemplate {
  return {
    id: 'tpl',
    country: 'NL',
    planCodes: ['basic', 'pro', 'enterprise'],
    category: 'domain',
    required: false,
    orderIndex: 0,
    actionType: 'info',
    href: null,
    autoCompleteSource: { type: 'manual' },
    label: { nl: 'L', fr: 'L', en: 'L' },
    description: { nl: 'D', fr: 'D', en: 'D' },
    ...overrides,
  };
}

function makeItem(
  template: ChecklistItemTemplate,
  status: ChecklistProgressItem['effectiveStatus'] = 'pending'
): ChecklistProgressItem {
  return {
    template,
    status: {
      id: `s-${template.id}`,
      tenant_id: 't-1',
      checklist_item_id: template.id,
      status: status === 'pending' ? 'pending' : status === 'completed' ? 'completed' : 'skipped',
      completed_at: null,
      notes: null,
    },
    autoCompleteResolved: false,
    effectiveStatus: status,
  };
}

const PROGRESS_EMPTY: ChecklistProgress = {
  total: 0,
  completed: 0,
  pendingRequired: 0,
  pendingOptional: 0,
  percentageComplete: 0,
  items: [],
};

describe('CATEGORY_ORDER', () => {
  it('puts domain + legal up front and content at the back', () => {
    expect(CATEGORY_ORDER[0]).toBe('domain');
    expect(CATEGORY_ORDER[1]).toBe('legal');
    expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe('content');
  });

  it('contains exactly the eight template categories with no duplicates', () => {
    expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
    expect(CATEGORY_ORDER).toHaveLength(8);
  });
});

describe('groupChecklistByCategory', () => {
  it('returns an empty array for an empty input', () => {
    expect(groupChecklistByCategory([])).toEqual([]);
  });

  it('skips categories with zero items', () => {
    const domainItem = makeItem(makeTemplate({ id: 'd', category: 'domain' }));
    const groups = groupChecklistByCategory([domainItem]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.category).toBe('domain');
  });

  it('orders categories using CATEGORY_ORDER, not insertion order', () => {
    const content = makeItem(makeTemplate({ id: 'c', category: 'content' }));
    const domain = makeItem(makeTemplate({ id: 'd', category: 'domain' }));
    const legal = makeItem(makeTemplate({ id: 'l', category: 'legal' }));
    // Input is shuffled; output must be domain → legal → content.
    const groups = groupChecklistByCategory([content, legal, domain]);
    expect(groups.map((g) => g.category)).toEqual(['domain', 'legal', 'content']);
  });

  it('sorts items within a group by template.orderIndex', () => {
    const a = makeItem(makeTemplate({ id: 'a', category: 'legal', orderIndex: 40 }));
    const b = makeItem(makeTemplate({ id: 'b', category: 'legal', orderIndex: 10 }));
    const c = makeItem(makeTemplate({ id: 'c', category: 'legal', orderIndex: 20 }));
    const [legalGroup] = groupChecklistByCategory([a, b, c]);
    expect(legalGroup?.items.map((i) => i.template.id)).toEqual(['b', 'c', 'a']);
  });

  it('computes per-group totals and completed counts', () => {
    const t1 = makeTemplate({ id: 't1', category: 'domain', required: true });
    const t2 = makeTemplate({ id: 't2', category: 'domain', required: false });
    const [group] = groupChecklistByCategory([makeItem(t1, 'completed'), makeItem(t2, 'pending')]);
    expect(group?.total).toBe(2);
    expect(group?.completed).toBe(1);
    expect(group?.requiredTotal).toBe(1);
    expect(group?.requiredCompleted).toBe(1);
    expect(group?.allRequiredCompleted).toBe(true);
  });

  it('marks allRequiredCompleted=false when any required item is pending', () => {
    const t = makeTemplate({ id: 't', category: 'legal', required: true });
    const [group] = groupChecklistByCategory([makeItem(t, 'pending')]);
    expect(group?.allRequiredCompleted).toBe(false);
  });

  it('treats skipped required items as completed for the gate', () => {
    const t = makeTemplate({ id: 't', category: 'legal', required: true });
    const [group] = groupChecklistByCategory([makeItem(t, 'skipped')]);
    expect(group?.completed).toBe(1);
    expect(group?.requiredCompleted).toBe(1);
    expect(group?.allRequiredCompleted).toBe(true);
  });

  it('allRequiredCompleted is true when a category has no required items', () => {
    const t = makeTemplate({ id: 't', category: 'newsletter', required: false });
    const [group] = groupChecklistByCategory([makeItem(t, 'pending')]);
    expect(group?.allRequiredCompleted).toBe(true);
    expect(group?.requiredTotal).toBe(0);
  });
});

describe('allRequiredDone', () => {
  it('returns false for an empty checklist', () => {
    expect(allRequiredDone(PROGRESS_EMPTY)).toBe(false);
  });

  it('returns true when pendingRequired is zero and there is at least one item', () => {
    expect(allRequiredDone({ ...PROGRESS_EMPTY, total: 5, pendingRequired: 0 })).toBe(true);
  });

  it('returns false when any required item is pending', () => {
    expect(allRequiredDone({ ...PROGRESS_EMPTY, total: 5, pendingRequired: 2 })).toBe(false);
  });
});

describe('firstPendingRequired', () => {
  it('returns null when every required item is done', () => {
    const t = makeTemplate({ id: 't', category: 'legal', required: true });
    const groups = groupChecklistByCategory([makeItem(t, 'completed')]);
    expect(firstPendingRequired(groups)).toBeNull();
  });

  it('returns the first pending required item in display order', () => {
    const t1 = makeTemplate({ id: 'a', category: 'domain', required: true, orderIndex: 10 });
    const t2 = makeTemplate({ id: 'b', category: 'legal', required: true, orderIndex: 20 });
    const groups = groupChecklistByCategory([makeItem(t1, 'pending'), makeItem(t2, 'pending')]);
    expect(firstPendingRequired(groups)?.template.id).toBe('a');
  });

  it('skips optional items', () => {
    const optional = makeTemplate({ id: 'opt', category: 'domain', required: false });
    const required = makeTemplate({
      id: 'req',
      category: 'legal',
      required: true,
      orderIndex: 20,
    });
    const groups = groupChecklistByCategory([
      makeItem(optional, 'pending'),
      makeItem(required, 'pending'),
    ]);
    expect(firstPendingRequired(groups)?.template.id).toBe('req');
  });
});
