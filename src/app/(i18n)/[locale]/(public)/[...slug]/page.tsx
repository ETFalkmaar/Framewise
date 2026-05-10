import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getCurrentTenant } from '@/lib/tenant';
import { resolvePage } from '@/lib/public-site/resolve-page';
import { type Locale } from '@/i18n/routing';
import { PublicPageRenderer } from '@/components/public-site/public-page-renderer';

/**
 * Canonical public catch-all for subdomain / custom-domain tenants.
 *
 * In production a tenant lands on this route via the
 * `subdomain` / `custom-domain` strategies in
 * `src/lib/tenant/resolver.ts`:
 *  - `villa-bonbini.com/over-ons` → tenant resolved → catch-all
 *    receives `slug = ['over-ons']`.
 *  - `demo-villa.framewise.app/contact` → same.
 *
 * In dev, where most localhost requests don't have a tenant in the
 * `x-framewise-tenant-id` header, this route 404s — that's
 * intentional. Use `/sites/<tenant>/<page>` for dev preview, which
 * renders the same `<PublicPageRenderer />` via the path-prefix
 * routes one folder over.
 *
 * The `(public)` route group keeps this file out of the URL but
 * scopes the layout (e.g. no admin chrome). At the URL level it
 * matches `/<locale>/<...slug>` — concrete routes like
 * `/<locale>/login` or `/<locale>/account` take precedence so we
 * don't shadow them.
 */
export default async function PublicCatchAllPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string[] }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const pageSlug = (slug ?? []).join('/');

  const resolved = await resolvePage({
    tenantId: tenant.id,
    pageSlug,
    locale,
  });
  if (!resolved) notFound();

  return <PublicPageRenderer resolved={resolved} />;
}
