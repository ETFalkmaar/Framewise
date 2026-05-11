import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { subscriptionsRepo } from '@/lib/data';
import { getPreviewDraft } from '@/lib/editor/preview-cookie';
import { canEditBlocks } from '@/lib/permissions';
import { getCurrentTenant } from '@/lib/tenant';
import { resolvePage, resolvePreviewPage } from '@/lib/public-site/resolve-page';
import { type Locale } from '@/i18n/routing';
import { Link as I18nLink } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { PublicLayout } from '@/components/public-site/public-layout';
import { PublicPageRenderer } from '@/components/public-site/public-page-renderer';
import { resolveBaseUrl } from '@/lib/seo/base-url';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { buildOrganizationLD, buildWebPageLD } from '@/lib/seo/jsonld';
const ALL_LOCALES: Locale[] = ['nl', 'fr', 'en'];

// Step 29: ISR — refresh public pages once a minute. Mirrors
// `REVALIDATE_PUBLIC_PAGE` in `src/lib/perf/isr-config.ts`; the
// literal stays inline because Next 16 requires the segment
// config export to be statically analyzable as a number.
export const revalidate = 60;

/**
 * Public homepage for a tenant — rendered through the path-prefix
 * tenant resolver (`/sites/<slug>`). Same renderer as
 * `[locale]/(public)/[...slug]/page.tsx` and
 * `[locale]/sites/[slug]/[...rest]/page.tsx` so output is identical
 * across all three entry points.
 *
 * Step 45 adds preview-mode support: when `?preview=true&pageId=<id>`
 * is set AND the requester is an authenticated editor on the
 * tenant, the renderer pulls draft blocks from the per-page cookie
 * instead of the persisted ones. Unauthenticated visitors hitting
 * the same URL silently fall through to the normal published-only
 * render so no draft data leaks.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;

  const tenant = await getCurrentTenant();
  if (!tenant) return {};

  const resolved = await resolvePage({ tenantId: tenant.id, pageSlug: '', locale });
  if (!resolved) return {};

  return buildPageMetadata({
    resolved,
    locale,
    baseUrl: resolveBaseUrl(),
    pathname: `/sites/${slug}`,
    allLocales: ALL_LOCALES,
  });
}

export default async function TenantSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
  searchParams: Promise<{ preview?: string; pageId?: string; v?: string }>;
}) {
  const { locale, slug } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const previewMode = await resolvePreviewModeForTenant({
    tenantId: tenant.id,
    requestedPreview: search.preview === 'true',
    requestedPageId: search.pageId,
  });

  const resolved = previewMode
    ? await resolvePreviewPage({
        tenantId: tenant.id,
        pageSlug: '',
        locale,
        draftBlocks: previewMode.draftBlocks,
      })
    : await resolvePage({
        tenantId: tenant.id,
        pageSlug: '',
        locale,
      });
  if (!resolved) notFound();

  const baseUrl = resolveBaseUrl();
  const orgLd = buildOrganizationLD({ tenant: resolved.tenant, baseUrl });
  const pageLd = buildWebPageLD({
    resolved,
    locale,
    baseUrl,
    pathname: `/sites/${slug}`,
  });

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        data-testid="jsonld-organization"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
      />
      <script
        type="application/ld+json"
        data-testid="jsonld-webpage"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd) }}
      />
      {previewMode ? (
        <PreviewModeBanner />
      ) : (
        <AdminPreviewBanner tenantName={tenant.name} slug={slug} />
      )}
      {tenant.bookings_enabled ? <ReservationCta slug={slug} /> : null}
      <PublicPageRenderer resolved={resolved} />
    </PublicLayout>
  );
}

/**
 * Sticky "Reserveren" call-to-action shown on every public tenant
 * page when `bookings_enabled`. Step 51 — placed above the renderer
 * so it shows even on tenants without a header block. A later block
 * type (fase 17) will replace this with an inline CTA the tenant
 * can drop anywhere on the page.
 */
function ReservationCta({ slug }: { slug: string }): React.JSX.Element {
  return (
    <div
      data-testid="public-reserve-cta"
      className="bg-primary text-primary-foreground sticky top-0 z-40 flex items-center justify-center gap-3 px-4 py-2 text-sm shadow-sm"
    >
      <span className="font-medium">Online reservering beschikbaar</span>
      <I18nLink
        href={`/sites/${slug}/boek`}
        data-testid="public-reserve-link"
        className="bg-background text-foreground hover:bg-muted rounded-md px-3 py-1 font-mono text-xs"
      >
        Reserveren →
      </I18nLink>
    </div>
  );
}

interface PreviewModeContext {
  draftBlocks: import('@/types/database').Block[] | null;
}

/**
 * Resolve preview-mode if `?preview=true&pageId=<id>` was supplied
 * AND the caller is an authenticated editor on the requested
 * tenant. Returns `null` (= normal render) for every other case so
 * draft data never leaks to anonymous visitors.
 *
 * The cookie may be missing or stale — that's fine; we still flip
 * into preview mode (skipping the `published` gate) but the iframe
 * just sees persisted blocks until the editor pushes its first
 * draft.
 */
async function resolvePreviewModeForTenant(input: {
  tenantId: string;
  requestedPreview: boolean;
  requestedPageId: string | undefined;
}): Promise<PreviewModeContext | null> {
  if (!input.requestedPreview || !input.requestedPageId) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const activeTenant = await getActiveTenantForUser();
  if (!activeTenant || activeTenant.id !== input.tenantId) return null;

  const subscription = await subscriptionsRepo.findByTenant(activeTenant.id);
  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const editable = await canEditBlocks(user.id, activeTenant, plan?.code ?? null);
  if (!editable) return null;

  const draft = await getPreviewDraft(input.requestedPageId);
  return { draftBlocks: draft?.blocks ?? null };
}

function PreviewModeBanner() {
  return (
    <div
      data-testid="preview-mode-banner"
      className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-xs text-amber-700 dark:text-amber-300"
    >
      <Badge variant="outline" className="font-mono">
        live preview
      </Badge>
      <span>Voorvertoning — wijzigingen worden direct getoond</span>
    </div>
  );
}

function AdminPreviewBanner({ tenantName, slug }: { tenantName: string; slug: string }) {
  return (
    <div
      data-testid="admin-preview-banner"
      className="bg-muted text-muted-foreground flex items-center justify-center gap-2 border-b px-4 py-2 text-xs"
    >
      <Badge variant="outline" className="font-mono">
        admin preview
      </Badge>
      <span>
        Path-prefix render of <span className="text-foreground font-mono">{tenantName}</span> (
        <span className="font-mono">/sites/{slug}</span>)
      </span>
    </div>
  );
}
