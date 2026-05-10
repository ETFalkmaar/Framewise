import type { ChecklistCategory, ChecklistProgress, ChecklistProgressItem } from './index';

/**
 * Order the category sections appear in the setup-page UI (step 31).
 * Roughly: "make the site reachable" first (domain + legal), then
 * money-handling (accounting + payments), then customer reach (CRM,
 * newsletter, phone), then editorial content. Items inside a section
 * keep their per-template `orderIndex`.
 */
export const CATEGORY_ORDER: ChecklistCategory[] = [
  'domain',
  'legal',
  'accounting',
  'payments',
  'crm',
  'newsletter',
  'phone',
  'content',
];

export const CATEGORY_ICON: Record<ChecklistCategory, string> = {
  domain: '🌐',
  legal: '⚖️',
  accounting: '📒',
  payments: '💳',
  crm: '🗂️',
  newsletter: '✉️',
  phone: '📞',
  content: '📝',
};

export interface ChecklistCategoryGroup {
  category: ChecklistCategory;
  /** Display order index, useful when serialising the rendered list. */
  index: number;
  items: ChecklistProgressItem[];
  total: number;
  completed: number;
  requiredTotal: number;
  requiredCompleted: number;
  allRequiredCompleted: boolean;
}

/**
 * Group the progress list by `template.category` and apply the
 * project-wide ordering (`CATEGORY_ORDER`). Categories with zero
 * items are omitted so the UI doesn't render empty sections for
 * plans that exclude a whole vertical (e.g. Basic has no CRM).
 *
 * Required vs total counts are computed per group so the section
 * header can show "✓ 2/3 done · 1 required pending" without the
 * UI needing to scan the full list a second time.
 */
export function groupChecklistByCategory(items: ChecklistProgressItem[]): ChecklistCategoryGroup[] {
  const buckets = new Map<ChecklistCategory, ChecklistProgressItem[]>();
  for (const item of items) {
    const list = buckets.get(item.template.category) ?? [];
    list.push(item);
    buckets.set(item.template.category, list);
  }

  const groups: ChecklistCategoryGroup[] = [];
  CATEGORY_ORDER.forEach((category, index) => {
    const groupItems = buckets.get(category);
    if (!groupItems || groupItems.length === 0) return;

    const sorted = [...groupItems].sort((a, b) => a.template.orderIndex - b.template.orderIndex);
    const completed = sorted.filter((i) => isCompleted(i)).length;
    const requiredTotal = sorted.filter((i) => i.template.required).length;
    const requiredCompleted = sorted.filter((i) => i.template.required && isCompleted(i)).length;

    groups.push({
      category,
      index,
      items: sorted,
      total: sorted.length,
      completed,
      requiredTotal,
      requiredCompleted,
      allRequiredCompleted: requiredTotal === 0 || requiredCompleted === requiredTotal,
    });
  });

  return groups;
}

/**
 * Returns `true` when every required item across the tenant's
 * checklist is in an effective `completed` (or `skipped`) state.
 *
 * Used by the page-level "can the site go live?" gate; step 32
 * adds the actual publish action behind this flag.
 */
export function allRequiredDone(progress: ChecklistProgress): boolean {
  return progress.pendingRequired === 0 && progress.total > 0;
}

/**
 * Find the first incomplete required item in display order so the
 * status banner can deep-link to it. Returns `null` when nothing is
 * pending (caller renders the "ready to go live" state instead).
 */
export function firstPendingRequired(
  groups: ChecklistCategoryGroup[]
): ChecklistProgressItem | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.template.required && !isCompleted(item)) return item;
    }
  }
  return null;
}

function isCompleted(item: ChecklistProgressItem): boolean {
  return item.effectiveStatus === 'completed' || item.effectiveStatus === 'skipped';
}
