import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentTenantWithSubscription } from '@/lib/tenant';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type Locale } from '@/i18n/routing';

export default async function TenantSitePage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tenantContext = await getCurrentTenantWithSubscription();
  if (!tenantContext) {
    notFound();
  }

  const { tenant, plan, subscription } = tenantContext;

  return (
    <main
      data-testid="tenant-site-page"
      className="bg-background text-foreground relative mx-auto flex min-h-screen max-w-screen-md flex-col px-6 py-24"
    >
      <header className="mb-10 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            /sites/{slug}
          </Badge>
          <Badge variant="secondary" className="font-mono">
            tenant context resolved
          </Badge>
        </div>
        <h1 className="text-display-lg font-bold tracking-tight">{tenant.name}</h1>
        <p className="text-muted-foreground text-lg">
          You are viewing this Framewise site through the path-prefix tenant resolver. The same data
          is available through custom-domain and subdomain routes once DNS is wired up.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm" data-testid="tenant-card-tenant">
          <CardHeader>
            <CardTitle className="text-sm">Tenant</CardTitle>
            <CardDescription className="font-mono text-xs">{tenant.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <KeyVal k="slug" v={tenant.slug} />
            <KeyVal k="country" v={tenant.country} />
            <KeyVal k="status" v={tenant.status} />
            <KeyVal k="default_locale" v={tenant.default_locale} />
            <KeyVal k="enabled_locales" v={tenant.enabled_locales.join(', ')} />
            <KeyVal k="custom_domain" v={tenant.custom_domain ?? '—'} />
          </CardContent>
        </Card>

        <Card size="sm" data-testid="tenant-card-plan">
          <CardHeader>
            <CardTitle className="text-sm">Plan</CardTitle>
            <CardDescription className="font-mono text-xs">{plan.code}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <KeyVal k="name" v={plan.name} />
            <KeyVal k="monthly" v={`${plan.currency} ${plan.price_monthly_cents / 100}`} />
            <KeyVal k="max_pages" v={String(plan.max_pages)} />
            <KeyVal k="max_languages" v={String(plan.max_languages)} />
            <KeyVal k="support_h/yr" v={String(plan.support_hours_per_year)} />
          </CardContent>
        </Card>

        <Card size="sm" data-testid="tenant-card-subscription" className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Subscription</CardTitle>
            <CardDescription className="font-mono text-xs">{subscription.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <KeyVal k="status" v={subscription.status} />
            <KeyVal k="started_at" v={subscription.started_at} />
            <KeyVal k="period_end" v={subscription.current_period_end} />
            <KeyVal k="cancel_at_period_end" v={subscription.cancel_at_period_end ? 'yes' : 'no'} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function KeyVal({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3 font-mono text-xs">
      <span className="text-muted-foreground w-32 shrink-0">{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
