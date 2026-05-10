import type { ChecklistCategoryGroup, EffectiveChecklistStatus } from '@/lib/checklist';
import { CATEGORY_ICON } from '@/lib/checklist';

import { ChecklistItemCard } from './checklist-item-card';

interface CategoryCopy {
  title: Record<string, string>;
  /** "{completed} van {total} klaar" template */
  progress: string;
  pendingRequired: string;
  /** Reused by the item cards. */
  itemCopy: React.ComponentProps<typeof ChecklistItemCard>['copy'];
}

export interface ChecklistCategoryProps {
  group: ChecklistCategoryGroup;
  locale: 'nl' | 'fr' | 'en';
  copy: CategoryCopy;
  renderActions?: React.ComponentProps<typeof ChecklistItemCard>['renderActions'];
}

/**
 * One section in the setup page (step 31). Renders a header with the
 * category icon, the localised category name, and a "X/Y done"
 * counter — then a 1-column grid of `<ChecklistItemCard />`s.
 *
 * Server component. The card itself takes a `renderActions` prop the
 * page supplies for manual items so toggling stays a server action.
 */
export function ChecklistCategorySection({
  group,
  locale,
  copy,
  renderActions,
}: ChecklistCategoryProps): React.JSX.Element {
  const title = copy.title[group.category] ?? group.category;
  const progressText = copy.progress
    .replace('{completed}', String(group.completed))
    .replace('{total}', String(group.total));

  return (
    <section
      data-testid={`setup-category-${group.category}`}
      data-required-pending={
        group.requiredTotal > 0 && !group.allRequiredCompleted ? 'true' : 'false'
      }
      className="space-y-4"
    >
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="text-lg">
          {CATEGORY_ICON[group.category]}
        </span>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <span className="text-muted-foreground font-mono text-xs">{progressText}</span>
        {group.requiredTotal > 0 && !group.allRequiredCompleted && (
          <span
            data-testid={`setup-category-${group.category}-required-pending`}
            className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] tracking-wide text-amber-700 uppercase dark:text-amber-300"
          >
            {copy.pendingRequired}
          </span>
        )}
      </header>
      <div className="grid grid-cols-1 gap-3">
        {group.items.map((item) => (
          <ChecklistItemCard
            key={item.template.id}
            template={item.template}
            effectiveStatus={item.effectiveStatus as EffectiveChecklistStatus}
            autoCompleteResolved={item.autoCompleteResolved}
            locale={locale}
            copy={copy.itemCopy}
            renderActions={renderActions}
          />
        ))}
      </div>
    </section>
  );
}
