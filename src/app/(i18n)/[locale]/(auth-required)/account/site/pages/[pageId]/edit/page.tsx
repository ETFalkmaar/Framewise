import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EditPageLayout } from '@/components/editor/edit-page-layout';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { blocksRepo, mediaRepo, pageVersionsRepo, pagesRepo, subscriptionsRepo } from '@/lib/data';
import { canAddRemoveBlocks, canEditBlocks } from '@/lib/permissions';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { BlockType } from '@/types/database';

/**
 * Block list editor for a single page. Step 39 shipped this
 * read-only; step 40 wired drag-and-drop reordering; step 45 wraps
 * the whole thing in a split-view client component
 * (`<EditPageLayout>`) so the editor sits next to an iframe
 * showing the page rendered live with the current optimistic
 * block state.
 *
 * Permission shape unchanged from step 40 — only Pro/Enterprise
 * tenants with the editor role (or super-admin) get past the
 * `canEditBlocks` gate; add/remove is still Enterprise-only and
 * gated separately on the `+ block` button which lands in a
 * future step.
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

  const [blocks, mediaLibrary, versionCount] = await Promise.all([
    blocksRepo.findByPageId(pageId),
    mediaRepo.listByTenant(tenant.id),
    pageVersionsRepo.countByPage(pageId),
  ]);
  blocks.sort((a, b) => a.order_index - b.order_index);

  const t = await getTranslations('account.editor');
  const tHistory = await getTranslations('account.history');
  const tType = await getTranslations('account.editor.blockType');
  const tPreview = await getTranslations('account.editor.preview');

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

  // Step 45 — `pagePath` is the trailing URL bit for the iframe.
  // Empty for the home page (slug='home'), `/${slug}` otherwise.
  // Matches the convention in `[locale]/sites/[slug]/[...rest]/page.tsx`.
  const pagePath = page.slug === 'home' ? '' : `/${page.slug}`;

  const header = (
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
      <Link
        href={`/account/site/pages/${page.id}/history`}
        data-testid="link-history"
        className="text-muted-foreground hover:text-foreground mt-2 inline-block font-mono text-[11px] underline"
      >
        {tHistory('linkLabel', { count: versionCount })}
      </Link>
    </header>
  );

  const blockCountSection = (
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
  );

  if (blocks.length === 0) {
    return (
      <main
        data-testid="page-edit"
        className="bg-background text-foreground mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-16"
      >
        {header}
        {blockCountSection}
        <Card data-testid="blocks-empty">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            {t('blocksEmpty')}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main data-testid="page-edit" className="bg-background text-foreground">
      <EditPageLayout
        pageId={page.id}
        siteSlug={tenant.slug}
        pagePath={pagePath}
        locale={locale}
        blocks={blocks}
        canEdit
        mediaLibrary={mediaLibrary}
        copy={{
          togglePreviewShow: tPreview('togglePreviewShow'),
          togglePreviewHide: tPreview('togglePreviewHide'),
          preview: {
            title: tPreview('title'),
            loading: tPreview('loading'),
            deviceDesktopAria: tPreview('deviceDesktopAria'),
            deviceMobileAria: tPreview('deviceMobileAria'),
            errorTitle: tPreview('errorTitle'),
            draftWaiting: tPreview('draftWaiting'),
          },
        }}
        blockListCopy={{
          blockType: blockTypeLabels,
          editBlock: t('editBlock'),
          blockEditComingSoon: t('blockEditComingSoon'),
          dragHandle: t('dragHandle'),
          reordering: t('reordering'),
          reorderError: t('reorderError'),
          missingCountSingular: t('missingCountSingular'),
          missingCountPlural: t('missingCountPlural'),
        }}
        modalCopy={{
          title: t('editBlock'),
          cancel: t('cancel'),
          save: t('save'),
          saving: t('saving'),
          saved: t('saved'),
          saveError: t('saveError'),
          comingSoon: t('blockEditComingSoon'),
          tiptap: {
            bold: t('tiptap.bold'),
            italic: t('tiptap.italic'),
            link: t('tiptap.link'),
            linkUrl: t('tiptap.linkUrl'),
            linkApply: t('tiptap.linkApply'),
            linkCancel: t('tiptap.linkCancel'),
            linkRemove: t('tiptap.linkRemove'),
            heading: t('tiptap.heading'),
            bulletList: t('tiptap.bulletList'),
          },
          blockForms: {
            textContent: t('blockForms.textContent'),
            heroTitle: t('blockForms.heroTitle'),
            heroSubtitle: t('blockForms.heroSubtitle'),
            heroCtaText: t('blockForms.heroCtaText'),
            heroCtaUrl: t('blockForms.heroCtaUrl'),
            heroOverlay: t('blockForms.heroOverlay'),
            heroOverlayLight: t('blockForms.heroOverlayLight'),
            heroOverlayDark: t('blockForms.heroOverlayDark'),
            imageSelect: t('blockForms.imageSelect'),
            imageChange: t('blockForms.imageChange'),
            imageNone: t('blockForms.imageNone'),
            imageAlt: t('blockForms.imageAlt'),
            imageCaption: t('blockForms.imageCaption'),
          },
          imagePicker: {
            title: t('imagePicker.title'),
            tabExisting: t('imagePicker.tabExisting'),
            tabUpload: t('imagePicker.tabUpload'),
            empty: t('imagePicker.empty'),
            cancel: t('imagePicker.cancel'),
            upload: t('imagePicker.upload'),
            uploading: t('imagePicker.uploading'),
          },
          locales: {
            tabLabels: {
              nl: t('locales.nl'),
              fr: t('locales.fr'),
              en: t('locales.en'),
            },
            missingLabel: t('missingTranslation'),
          },
        }}
        header={header}
        blockCountSection={blockCountSection}
      />
    </main>
  );
}
