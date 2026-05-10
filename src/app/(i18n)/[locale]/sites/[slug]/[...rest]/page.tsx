import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getCurrentTenant } from '@/lib/tenant';
import { resolvePage } from '@/lib/public-site/resolve-page';
import { type Locale } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { PublicPageRenderer } from '@/components/public-site/public-page-renderer';

/**
 * Catch-all for inner public pages under the path-prefix tenant
 * route — `/sites/<tenant>/<page-slug>(/<sub-slug>)*`. Reuses
 * `resolvePage` + `PublicPageRenderer` so the output matches the
 * homepage at `/sites/<tenant>` and the canonical
 * `[locale]/(public)/[...slug]/page.tsx`.
 *
 * `rest` is joined with `/` so multi-segment slugs like
 * `over-ons/team` would route to a page with that exact slug if it
 * exists in the database. Step 24 only ships single-segment slugs
 * (over-ons, contact, …) but the routing supports deeper nesting
 * out of the box for step 30+.
 */
export default async function TenantSiteSubPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string; rest: string[] }>;
}) {
  const { locale, slug, rest } = await params;
  setRequestLocale(locale);

  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const pageSlug = (rest ?? []).join('/');

  const resolved = await resolvePage({
    tenantId: tenant.id,
    pageSlug,
    locale,
  });
  if (!resolved) notFound();

  return (
    <>
      <AdminPreviewBanner tenantName={tenant.name} tenantSlug={slug} pageSlug={pageSlug} />
      <PublicPageRenderer resolved={resolved} />
    </>
  );
}

function AdminPreviewBanner({
  tenantName,
  tenantSlug,
  pageSlug,
}: {
  tenantName: string;
  tenantSlug: string;
  pageSlug: string;
}) {
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
        <span className="font-mono">
          /sites/{tenantSlug}/{pageSlug}
        </span>
        )
      </span>
    </div>
  );
}
