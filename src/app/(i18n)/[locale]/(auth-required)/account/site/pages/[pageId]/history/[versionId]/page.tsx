import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { RestoreVersionButton } from '@/components/editor/restore-version-button';
import { Card, CardContent } from '@/components/ui/card';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { pageVersionsRepo, pagesRepo, subscriptionsRepo, usersRepo } from '@/lib/data';
import { blocksFromSnapshot } from '@/lib/editor/snapshot';
import { canEditBlocks } from '@/lib/permissions';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { BlockType } from '@/types/database';

const BLOCK_ICON: Record<BlockType, string> = {
  hero: '🦸',
  text: '📝',
  image: '🖼️',
  gallery: '🎞️',
  cta: '🔗',
  faq: '❓',
  pricing: '💰',
  contact: '📞',
};

/**
 * Read-only preview of a single page version (step 44). Shows
 * the block layout captured in `snapshot.blocks` so the customer
 * can decide whether to restore. The full-fledged public renderer
 * lands in step 45's live preview — here we render a simple list
 * so the customer can confirm the structure.
 */
export default async function VersionPreviewPage({
  params,
}: {
  params: Promise<{ locale: Locale; pageId: string; versionId: string }>;
}) {
  const { locale, pageId, versionId } = await params;
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

  const version = await pageVersionsRepo.findById(versionId);
  if (!version || version.page_id !== pageId) notFound();

  const author = await usersRepo.findById(version.created_by_user_id);
  const blocks = blocksFromSnapshot(version.snapshot);

  const t = await getTranslations('account.history');
  const tType = await getTranslations('account.editor.blockType');

  return (
    <main
      data-testid="version-preview"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href={`/account/site/pages/${pageId}/history`}
          data-testid="back-to-history"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToHistory')}
        </Link>
        <h1 className="text-display-md mt-1 font-bold tracking-tight">
          {t('versionPreview', { date: formatTimestamp(version.created_at) })}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          v{version.version_number} · {t('byUser', { user: author?.name ?? '—' })}
        </p>
        <div className="mt-3">
          <RestoreVersionButton
            pageId={pageId}
            versionId={versionId}
            copy={{
              cta: t('restoreVersion'),
              confirm: t('confirmRestore'),
              restoring: t('restoring'),
              restored: t('restored'),
            }}
          />
        </div>
      </header>

      {blocks.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-xs">—</CardContent>
        </Card>
      ) : (
        <ol className="grid gap-3">
          {blocks.map((block, i) => (
            <li key={block.id} data-testid={`preview-block-${block.id}`}>
              <Card>
                <CardContent className="flex items-start gap-3 p-4">
                  <span aria-hidden className="text-2xl leading-none">
                    {BLOCK_ICON[block.block_type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{tType(block.block_type)}</p>
                    <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                      #{i} ·{' '}
                      <span className="break-all">{truncate(extractExcerpt(block.data), 120)}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function extractExcerpt(data: Record<string, unknown>): string {
  const stack: unknown[] = [data];
  while (stack.length > 0) {
    const next = stack.pop();
    if (typeof next === 'string' && next.trim().length > 0) return next.trim();
    if (Array.isArray(next)) {
      for (let i = next.length - 1; i >= 0; i--) stack.push(next[i]);
    } else if (next && typeof next === 'object') {
      for (const v of Object.values(next as Record<string, unknown>)) stack.push(v);
    }
  }
  return '';
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
