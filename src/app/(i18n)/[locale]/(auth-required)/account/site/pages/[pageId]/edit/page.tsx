import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SortableBlockList } from '@/components/editor/sortable-block-list';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { blocksRepo, pagesRepo, subscriptionsRepo } from '@/lib/data';
import { canAddRemoveBlocks, canEditBlocks } from '@/lib/permissions';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { BlockType } from '@/types/database';

/**
 * Block list editor for a single page. Step 39 shipped this
 * read-only; step 40 wires the @dnd-kit sortable + the
 * `reorderBlocksAction` server action so customers can actually
 * change the order of their content.
 *
 * The drag handle only renders for users who can edit (Pro /
 * Enterprise + editor role; super-admin bypass). Pro tenants
 * can reorder but can't add/remove — that gate lives on the
 * "+ block" button further up the page.
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

  const blockTypeLabels: Record<BlockType, string> = {
    hero: tType('hero'),
    text: tType('text'),
    image: tType('image'),
    gallery: tType('gallery'),
    cta: tType('cta'),
    faq: tType('faq'),
    pricing: tType('pricing'),
    contact: tType('contact'),
  };

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
        <p
          className="text-muted-foreground mt-1 font-mono text-[11px]"
          data-testid="drag-instruction"
        >
          {t('dragToReorder')}
        </p>
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
        <SortableBlockList
          pageId={page.id}
          blocks={blocks}
          canEdit
          copy={{
            blockType: blockTypeLabels,
            editBlock: t('editBlock'),
            blockEditComingSoon: t('blockEditComingSoon'),
            dragHandle: t('dragHandle'),
            reordering: t('reordering'),
            reorderError: t('reorderError'),
          }}
        />
      )}
    </main>
  );
}
