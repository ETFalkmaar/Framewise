import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { blocksRepo, pagesRepo, subscriptionsRepo } from '@/lib/data';
import { canAddRemoveBlocks, canEditBlocks } from '@/lib/permissions';
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
 * Read-only block list for a single page (fase 12 step 39). The
 * heavy interactivity (drag-to-reorder, inline edit, rich text,
 * preview) lands in steps 40-46. This step ships the route + the
 * permission gate + the "what blocks does this page contain"
 * view so the rest of the fase has a foundation to attach to.
 *
 * The page falls back to the existing public renderer for the
 * actual content layout — what we render here is the *editor
 * preview* row: type icon, type label, and a tiny excerpt of the
 * block's content so the editor can identify what's what.
 */
export default async function EditPagePage({
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

  const allowAddRemove = await canAddRemoveBlocks(user.id, tenant, plan?.code ?? null);

  const blocks = await blocksRepo.findByPageId(pageId);
  blocks.sort((a, b) => a.order_index - b.order_index);

  const t = await getTranslations('account.editor');
  const tType = await getTranslations('account.editor.blockType');

  return (
    <main
      data-testid="page-edit"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-16"
    >
      <header className="mb-8">
        <Link
          href="/account/site/pages"
          data-testid="back-to-pages"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToPages')}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-display-md font-bold tracking-tight">/{page.slug || '/'}</h1>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {page.status}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">{t('blockListIntro')}</p>
      </header>

      <section className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground font-mono text-xs">
          {blocks.length} {t('blockSuffix')}
        </p>
        {allowAddRemove && (
          <button
            type="button"
            data-testid="add-block-trigger"
            disabled
            title={t('addBlockComingSoon')}
            className="ring-border bg-muted/40 text-muted-foreground inline-flex cursor-not-allowed items-center gap-1 rounded-md px-3 py-1.5 font-mono text-xs ring-1"
          >
            + {t('addBlock')}
          </button>
        )}
      </section>

      {blocks.length === 0 ? (
        <Card data-testid="blocks-empty">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            {t('blocksEmpty')}
          </CardContent>
        </Card>
      ) : (
        <ol className="grid gap-3">
          {blocks.map((block) => (
            <li key={block.id} data-testid={`block-row-${block.id}`}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className="text-2xl leading-none">
                      {BLOCK_ICON[block.block_type]}
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-sm">{tType(block.block_type)}</CardTitle>
                      <CardDescription className="font-mono text-[11px]">
                        {truncate(extractExcerpt(block.data), 80)}
                      </CardDescription>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid={`block-edit-trigger-${block.id}`}
                    disabled
                    title={t('blockEditComingSoon')}
                    className="ring-border bg-muted/40 text-muted-foreground inline-flex cursor-not-allowed items-center gap-1 rounded-md px-3 py-1.5 font-mono text-xs ring-1"
                  >
                    {t('editBlock')}
                  </button>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function extractExcerpt(data: Record<string, unknown>): string {
  // Walk the JSON payload picking up the first string value we
  // can read. Block schemas differ (hero vs text vs cta) so this
  // best-effort approach beats hand-wiring one extractor per type
  // — it's only for the "what is this block roughly" preview.
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
