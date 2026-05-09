import { Link } from '@/i18n/navigation';
import type { ChecklistItemTemplate, EffectiveChecklistStatus } from '@/lib/checklist';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const STATUS_DOT: Record<EffectiveChecklistStatus, string> = {
  completed: 'bg-emerald-500',
  pending: 'bg-amber-500',
  skipped: 'bg-muted-foreground/40',
};

const STATUS_BADGE: Record<
  EffectiveChecklistStatus,
  'secondary' | 'outline' | 'destructive' | 'ghost'
> = {
  completed: 'secondary',
  pending: 'outline',
  skipped: 'ghost',
};

const CATEGORY_ICON: Record<ChecklistItemTemplate['category'], string> = {
  domain: '🌐',
  accounting: '📒',
  payments: '💳',
  phone: '📞',
  crm: '🗂️',
  newsletter: '✉️',
  content: '📝',
  legal: '⚖️',
};

export interface ChecklistItemCardProps {
  template: ChecklistItemTemplate;
  effectiveStatus: EffectiveChecklistStatus;
  autoCompleteResolved: boolean;
  locale: 'nl' | 'fr' | 'en';
  copy: {
    statusLabel: Record<EffectiveChecklistStatus, string>;
    requiredBadge: string;
    optionalBadge: string;
    autoCompletedHint: string;
    markCompleted: string;
    markPending: string;
    markSkipped: string;
    actionAutoComplete: string;
  };
  /**
   * Server-action form. Receives the template id + intended status.
   * Rendered as three small <button formaction> entries. The page
   * supplies it as a `<form action={action}>` wrapper element.
   */
  renderActions?: (template: ChecklistItemTemplate) => React.ReactNode;
}

export function ChecklistItemCard({
  template,
  effectiveStatus,
  autoCompleteResolved,
  locale,
  copy,
  renderActions,
}: ChecklistItemCardProps) {
  const isManual = template.actionType === 'manual';
  const label = template.label[locale];
  const description = template.description[locale];

  return (
    <Card
      size="sm"
      data-testid={`checklist-card-${template.id}`}
      data-status={effectiveStatus}
      data-auto-complete={autoCompleteResolved ? '1' : '0'}
      className="h-full"
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-base">
            {CATEGORY_ICON[template.category]}
          </span>
          <span
            aria-hidden="true"
            className={cn('inline-block h-2.5 w-2.5 rounded-full', STATUS_DOT[effectiveStatus])}
            data-testid={`checklist-dot-${template.id}`}
          />
          <CardTitle className="text-sm">
            {template.href ? (
              <Link href={template.href} className="hover:text-foreground/80">
                {label}
              </Link>
            ) : (
              label
            )}
          </CardTitle>
          <Badge variant={STATUS_BADGE[effectiveStatus]} className="ml-auto font-mono text-[10px]">
            {copy.statusLabel[effectiveStatus]}
          </Badge>
        </div>
        <CardDescription className="text-[11px]">
          <span className="font-mono">{template.id}</span> ·{' '}
          {template.required ? copy.requiredBadge : copy.optionalBadge}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p className="text-muted-foreground leading-snug">{description}</p>
        {!isManual && autoCompleteResolved === false && (
          <p className="text-muted-foreground border-border/60 bg-muted/30 rounded-md border px-2 py-1.5 text-[11px]">
            {copy.autoCompletedHint.replace('{action}', copy.actionAutoComplete)}
          </p>
        )}
        {!isManual && autoCompleteResolved === true && (
          <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
            ✓ {copy.statusLabel.completed}
          </p>
        )}
        {isManual && renderActions && (
          <div className="flex flex-wrap gap-2">{renderActions(template)}</div>
        )}
      </CardContent>
    </Card>
  );
}
