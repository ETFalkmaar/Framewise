import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { getActiveTenantForUser } from '@/lib/auth';
import { canTenantGoLive } from '@/lib/validation';
import {
  computeChecklistProgress,
  type ChecklistItemTemplate,
  type EffectiveChecklistStatus,
} from '@/lib/checklist';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChecklistProgressBar } from '@/components/checklist/checklist-progress-bar';
import { ChecklistStatusBanner } from '@/components/checklist/checklist-status-banner';
import { ChecklistItemCard } from '@/components/checklist/checklist-item-card';

import { markItemCompletedAction, markItemPendingAction, markItemSkippedAction } from './actions';

export default async function SetupPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('account.setup');
  const tAccount = await getTranslations('account');

  const tenant = await getActiveTenantForUser();

  if (!tenant) {
    return (
      <main
        data-testid="setup-page"
        className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-md flex-col px-6 py-24"
      >
        <header className="mb-10">
          <Badge variant="outline" className="font-mono">
            /account/setup
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('title')}</h1>
        </header>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t('noTenant')}</CardTitle>
          </CardHeader>
        </Card>
        <p className="mt-8">
          <Link
            href="/account"
            className="text-muted-foreground hover:text-foreground font-mono text-xs underline"
          >
            ← {tAccount('title')}
          </Link>
        </p>
      </main>
    );
  }

  const [progress, goLive] = await Promise.all([
    computeChecklistProgress(tenant.id),
    canTenantGoLive(tenant.id),
  ]);

  const actionAutoComplete = t('actionAutoComplete');
  const cardCopy = {
    statusLabel: {
      completed: t('statusLabel.completed'),
      pending: t('statusLabel.pending'),
      skipped: t('statusLabel.skipped'),
    } satisfies Record<EffectiveChecklistStatus, string>,
    requiredBadge: t('requiredBadge'),
    optionalBadge: t('optionalBadge'),
    autoCompletedHint: t('autoCompletedHint', { action: actionAutoComplete }),
    actionAutoComplete,
    markCompleted: t('markCompleted'),
    markPending: t('markPending'),
    markSkipped: t('markSkipped'),
  };

  const required = progress.items.filter((i) => i.template.required);
  const optional = progress.items.filter((i) => !i.template.required);

  return (
    <main
      data-testid="setup-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-xl flex-col px-6 py-16"
    >
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline" className="font-mono">
            /account/setup
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Badge variant="secondary">{tenant.country}</Badge>
          <Badge variant="outline">{tenant.name}</Badge>
        </div>
      </header>

      <ChecklistProgressBar
        total={progress.total}
        completed={progress.completed}
        percentage={progress.percentageComplete}
        label={t('progressLabel')}
        className="mb-6"
      />

      <ChecklistStatusBanner
        canGoLive={goLive.canGoLive}
        copy={{
          canGoLive: t('canGoLive'),
          cannotGoLive: t('cannotGoLive', { count: progress.pendingRequired }),
          goLiveButton: t('goLiveButton'),
          goLiveDisabled: t('goLiveDisabled'),
        }}
        className="mb-10"
      />

      <ChecklistSection
        testId="checklist-section-required"
        title={t('requiredSection')}
        items={required}
        locale={locale}
        cardCopy={cardCopy}
        emptyHint={t('emptyRequired')}
      />

      <ChecklistSection
        testId="checklist-section-optional"
        title={t('optionalSection')}
        items={optional}
        locale={locale}
        cardCopy={cardCopy}
        emptyHint={t('emptyOptional')}
      />

      <Separator className="my-12" />
      <p className="text-muted-foreground font-mono text-xs">
        <Link href="/account" className="hover:text-foreground underline">
          ← {tAccount('title')}
        </Link>
      </p>
    </main>
  );
}

function ChecklistSection({
  testId,
  title,
  items,
  locale,
  cardCopy,
  emptyHint,
}: {
  testId: string;
  title: string;
  items: Array<{
    template: ChecklistItemTemplate;
    autoCompleteResolved: boolean;
    effectiveStatus: EffectiveChecklistStatus;
  }>;
  locale: Locale;
  cardCopy: React.ComponentProps<typeof ChecklistItemCard>['copy'];
  emptyHint: string;
}) {
  return (
    <section className="mb-10" data-testid={testId}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-display-sm font-semibold tracking-tight">
          {title}{' '}
          <span className="text-muted-foreground text-base font-medium">({items.length})</span>
        </h2>
      </div>
      <Separator className="mb-4" />
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyHint}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ChecklistItemCard
              key={item.template.id}
              template={item.template}
              effectiveStatus={item.effectiveStatus}
              autoCompleteResolved={item.autoCompleteResolved}
              locale={locale}
              copy={cardCopy}
              renderActions={(template) => (
                <ManualActions
                  templateId={template.id}
                  effectiveStatus={item.effectiveStatus}
                  copy={cardCopy}
                />
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ManualActions({
  templateId,
  effectiveStatus,
  copy,
}: {
  templateId: string;
  effectiveStatus: EffectiveChecklistStatus;
  copy: React.ComponentProps<typeof ChecklistItemCard>['copy'];
}) {
  return (
    <>
      {effectiveStatus !== 'completed' && (
        <form action={markItemCompletedAction}>
          <input type="hidden" name="templateId" value={templateId} />
          <button
            type="submit"
            data-testid={`btn-complete-${templateId}`}
            className="ring-border bg-background hover:bg-muted rounded-md px-2 py-1 font-mono text-[11px] ring-1"
          >
            ✓ {copy.markCompleted}
          </button>
        </form>
      )}
      {effectiveStatus !== 'pending' && (
        <form action={markItemPendingAction}>
          <input type="hidden" name="templateId" value={templateId} />
          <button
            type="submit"
            data-testid={`btn-pending-${templateId}`}
            className="ring-border bg-background hover:bg-muted rounded-md px-2 py-1 font-mono text-[11px] ring-1"
          >
            ↺ {copy.markPending}
          </button>
        </form>
      )}
      {effectiveStatus !== 'skipped' && (
        <form action={markItemSkippedAction}>
          <input type="hidden" name="templateId" value={templateId} />
          <button
            type="submit"
            data-testid={`btn-skip-${templateId}`}
            className="ring-border bg-background hover:bg-muted rounded-md px-2 py-1 font-mono text-[11px] ring-1"
          >
            – {copy.markSkipped}
          </button>
        </form>
      )}
    </>
  );
}
