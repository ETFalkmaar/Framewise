import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getActiveTenantForUser, getCurrentUserWithTenants, isUserSuperAdmin } from '@/lib/auth';
import { LogoutButton } from '@/components/auth/logout-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';

export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('account');
  const ctx = await getCurrentUserWithTenants();
  // Layout already redirects if not authenticated, but keep a defensive check.
  if (!ctx) return null;

  const { user, tenants } = ctx;
  const activeTenant = await getActiveTenantForUser();
  const superAdmin = isUserSuperAdmin(user.id);

  return (
    <main
      data-testid="account-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-md flex-col px-6 py-24"
    >
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <Badge variant="outline" className="font-mono">
            /account
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">{t('title')}</h1>
          {superAdmin && (
            <Badge variant="secondary" className="mt-2 font-mono">
              super-admin
            </Badge>
          )}
        </div>
        <LogoutButton />
      </header>

      <div className="grid gap-4">
        <Card size="sm" data-testid="account-card-user">
          <CardHeader>
            <CardTitle className="text-sm">{user.name}</CardTitle>
            <CardDescription className="font-mono text-xs">{user.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <KeyVal k={t('email')} v={user.email} />
          </CardContent>
        </Card>

        <Card size="sm" data-testid="account-card-tenants">
          <CardHeader>
            <CardTitle className="text-sm">
              {t('tenants')}{' '}
              <span className="text-muted-foreground text-xs font-medium">({tenants.length})</span>
            </CardTitle>
            {activeTenant && (
              <CardDescription className="font-mono text-xs">
                {t('activeTenant')}: {activeTenant.name}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('noTenants')}</p>
            ) : (
              <ul className="space-y-2">
                {tenants.map((tenant, i) => (
                  <li
                    key={tenant.id}
                    className="flex items-center justify-between font-mono text-xs"
                  >
                    <span>
                      <span className="text-foreground">{tenant.name}</span>
                      <span className="text-muted-foreground"> · {tenant.slug}</span>
                    </span>
                    <Badge variant="outline">{tenant.country}</Badge>
                    {i === 0 && <></>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-12" />
      <div className="space-y-3">
        <Link
          href="/account/connections"
          data-testid="link-connections"
          className="text-foreground hover:bg-muted ring-border inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
        >
          → {t('viewConnections')}
        </Link>
        <p className="text-muted-foreground font-mono text-xs">
          Mock auth — Supabase replacement scheduled for step 119/118.
        </p>
      </div>
    </main>
  );
}

function KeyVal({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3 font-mono text-xs">
      <span className="text-muted-foreground w-24 shrink-0">{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
