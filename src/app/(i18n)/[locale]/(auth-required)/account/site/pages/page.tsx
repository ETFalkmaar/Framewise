import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { blocksRepo, pagesRepo, subscriptionsRepo } from '@/lib/data';
import { canAddRemoveBlocks, canEditBlocks } from '@/lib/permissions';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { PageStatus } from '@/types/database';

/**
 * Pages list — entry point for the customer-facing block editor
 * (fase 12 step 39). Pro + Enterprise customers see the list of
 * their pages with a "Bewerken" link per row. Basic customers
 * are redirected (the editor isn't part of their plan).
 *
 * Super-admin sees the list too and acts as a fall-through
 * preview for QA / hands-on troubleshooting.
 */
export default async function AccountPagesIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenantForUser();
  if (!tenant) notFound();

  const subscription = await subscriptionsRepo.findByTenant(tenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;

  const editable = await canEditBlocks(user.id, tenant, plan?.code ?? null);
  if (!editable) redirect('/account');

  const allowAddRemove = await canAddRemoveBlocks(user.id, tenant, plan?.code ?? null);

  const pages = await pagesRepo.listByTenant(tenant.id);
  const t = await getTranslations('account.editor');
  const tStatus = await getTranslations('account.editor.status');

  const statusLabels: Record<PageStatus, string> = {
    draft: tStatus('draft'),
    published: tStatus('published'),
    archived: tStatus('archived'),
  };

  // Hydrate the block counts in one parallel pass so the rendered
  // list can show "5 blocks" without N round-trips on render.
  const blockCounts = await Promise.all(
    pages.map(async (p) => ({ id: p.id, count: (await blocksRepo.findByPageId(p.id)).length }))
  );
  const blocksByPageId = new Map(blockCounts.map((b) => [b.id, b.count]));

  return (
    <main
      data-testid="pages-index"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-16"
    >
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            /account/site/pages
          </p>
          <h1 className="text-display-md mt-1 font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t('subtitle', { tenant: tenant.name })}
          </p>
        </div>
        {allowAddRemove && (
          <Link href="/account/site/pages/new" data-testid="link-create-page">
            <span className="ring-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1">
              + {t('newPage')}
            </span>
          </Link>
        )}
      </header>

      {pages.length === 0 ? (
        <Card data-testid="pages-empty">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {pages
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((page) => (
              <Card key={page.id} data-testid={`page-row-${page.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm">/{page.slug || '/'}</CardTitle>
                    <CardDescription className="font-mono text-[11px]">
                      {blocksByPageId.get(page.id) ?? 0} {t('blockSuffix')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={page.status === 'published' ? 'default' : 'outline'}
                      className="font-mono text-[10px] uppercase"
                      data-testid={`page-status-${page.id}`}
                    >
                      {statusLabels[page.status]}
                    </Badge>
                    <Link
                      href={`/account/site/pages/${page.id}/edit`}
                      data-testid={`page-edit-link-${page.id}`}
                      className="ring-border bg-background hover:bg-muted inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-mono text-xs ring-1"
                    >
                      {t('edit')} →
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="text-muted-foreground pt-0 text-xs">
                  <p>
                    {t('updatedAt')}:{' '}
                    <span className="font-mono">{page.updated_at.slice(0, 10)}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </main>
  );
}
