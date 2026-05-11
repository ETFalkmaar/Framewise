import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { RestoreVersionButton } from '@/components/editor/restore-version-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { pageVersionsRepo, pagesRepo, subscriptionsRepo, usersRepo } from '@/lib/data';
import { canEditBlocks } from '@/lib/permissions';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { PageVersion, User } from '@/types/database';

/**
 * Version history viewer (step 44, fase 12 part 6/8). Lists every
 * snapshot that the auto-save flow has captured for this page,
 * newest first. Each row links to a read-only preview and offers
 * a restore button. The restore action also snapshots the
 * current state so the customer can undo the undo.
 */
export default async function PageHistoryPage({
  params,
}: {
  params: Promise<{ locale: Locale; pageId: string }>;
}) {
  const { locale, pageId } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenantForUser();
  if (!tenant) notFound();

  const page = await pagesRepo.findById(pageId);
  if (!page || page.tenant_id !== tenant.id) notFound();

  const subscription = await subscriptionsRepo.findByTenant(tenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const editable = await canEditBlocks(user.id, tenant, plan?.code ?? null);
  if (!editable) redirect('/account');

  const versions = await pageVersionsRepo.listByPage(pageId, { limit: 50 });

  const t = await getTranslations('account.history');
  const tSummary = await getTranslations('account.history.changeSummary');

  // Hydrate user names once.
  const userIds = Array.from(new Set(versions.map((v) => v.created_by_user_id)));
  const users = new Map<string, User>();
  for (const id of userIds) {
    const u = await usersRepo.findById(id);
    if (u) users.set(id, u);
  }

  return (
    <main
      data-testid="history-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href={`/account/site/pages/${pageId}/edit`}
          data-testid="back-to-edit"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToEdit')}
        </Link>
        <h1 className="text-display-md mt-1 font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
      </header>

      {versions.length === 0 ? (
        <Card data-testid="history-empty">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            <p>{t('empty')}</p>
            <p className="mt-2 text-xs">{t('emptyHelp')}</p>
          </CardContent>
        </Card>
      ) : (
        <ol className="grid gap-3">
          {versions.map((version) => {
            const author = users.get(version.created_by_user_id);
            const summaryKey = (version.comment ?? '') as keyof typeof CHANGE_SUMMARY_KEYS;
            const summaryLabel = CHANGE_SUMMARY_KEYS[summaryKey]
              ? tSummary(CHANGE_SUMMARY_KEYS[summaryKey])
              : (version.comment ?? '—');
            return (
              <li key={version.id} data-testid={`version-row-${version.id}`}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="text-sm">
                        v{version.version_number} · {summaryLabel}
                      </CardTitle>
                      <CardDescription className="font-mono text-[11px]">
                        {formatTimestamp(version.created_at)}
                        {author && (
                          <>
                            {' · '}
                            {t('byUser', { user: author.name })}
                          </>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/account/site/pages/${pageId}/history/${version.id}`}
                        data-testid={`view-version-${version.id}`}
                        className="ring-border bg-background hover:bg-muted inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-mono text-xs ring-1 transition"
                      >
                        {t('viewVersion')}
                      </Link>
                      <RestoreVersionButton
                        pageId={pageId}
                        versionId={version.id}
                        copy={{
                          cta: t('restoreVersion'),
                          confirm: t('confirmRestore'),
                          restoring: t('restoring'),
                          restored: t('restored'),
                        }}
                      />
                    </div>
                  </CardHeader>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}

/**
 * Map of stable `change_summary` codes to their i18n key. Anything
 * not in the map is rendered verbatim so old snapshots without a
 * code still show something readable.
 */
const CHANGE_SUMMARY_KEYS: Record<string, string> = {
  block_content_saved: 'block_content_saved',
  blocks_reordered: 'blocks_reordered',
  version_restored: 'version_restored',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export type { PageVersion };
