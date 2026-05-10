import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getCurrentTenant } from '@/lib/tenant';
import { resolvePage } from '@/lib/public-site/resolve-page';
import { type Locale } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { PublicPageRenderer } from '@/components/public-site/public-page-renderer';

/**
 * Public homepage for a tenant — rendered through the path-prefix
 * tenant resolver (`/sites/<slug>`). Same renderer as
 * `[locale]/(public)/[...slug]/page.tsx` and
 * `[locale]/sites/[slug]/[...rest]/page.tsx` so output is identical
 * across all three entry points.
 *
 * A small "admin preview" badge is rendered above the page so
 * developers can tell at a glance which entry they used. Production
 * subdomain / custom-domain rendering doesn't show the banner —
 * see `[locale]/(public)/[...slug]/page.tsx`.
 */
export default async function TenantSitePage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const resolved = await resolvePage({
    tenantId: tenant.id,
    pageSlug: '',
    locale,
  });
  if (!resolved) notFound();

  return (
    <>
      <AdminPreviewBanner tenantName={tenant.name} slug={slug} />
      <PublicPageRenderer resolved={resolved} />
    </>
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
