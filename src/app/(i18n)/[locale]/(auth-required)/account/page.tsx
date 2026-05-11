import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getActiveTenantForUser, getCurrentUserWithTenants, isUserSuperAdmin } from '@/lib/auth';
import { computeChecklistProgress } from '@/lib/checklist';
import { notificationsRepo, subscriptionsRepo } from '@/lib/data';
import { canEditBlocks } from '@/lib/permissions';
import { getGoLiveCelebrationData } from '@/lib/site/go-live';
import { GoLiveCelebration } from '@/components/account/go-live-celebration';
import { LogoutButton } from '@/components/auth/logout-button';
import { PublishStatusBanner } from '@/components/account/publish-status-banner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChecklistProgressBar } from '@/components/checklist/checklist-progress-bar';
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
  const checklistProgress = activeTenant ? await computeChecklistProgress(activeTenant.id) : null;
  const tSetup = await getTranslations('account.setup');
  const tPublish = await getTranslations('account.publish');
  const tGoLive = await getTranslations('goLive');

  // Step 48 — celebration mode: tenant live AND unread publish_approved
  // notification. The dismiss action marks the notification read so the
  // banner doesn't keep showing up on subsequent /account renders.
  let goLiveCelebration: {
    data: Awaited<ReturnType<typeof getGoLiveCelebrationData>>;
    notificationId: string;
  } | null = null;
  if (activeTenant && activeTenant.status === 'live') {
    const unread = await notificationsRepo.listByUser(user.id, {
      unreadOnly: true,
      limit: 10,
    });
    const approvalNotif = unread.find(
      (n) => n.type === 'publish_approved' && n.tenant_id === activeTenant.id
    );
    if (approvalNotif) {
      const data = await getGoLiveCelebrationData(activeTenant.id);
      if (data) {
        goLiveCelebration = { data, notificationId: approvalNotif.id };
      }
    }
  }

  // Step 39: surface the block-editor entry point only for plans
  // that unlock it (pro + enterprise) — basic customers don't
  // see the link at all.
  let editorVisible = false;
  if (activeTenant) {
    const subscription = await subscriptionsRepo.findByTenant(activeTenant.id);
    const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
    editorVisible = await canEditBlocks(user.id, activeTenant, plan?.code ?? null);
  }

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

      {goLiveCelebration && goLiveCelebration.data && (
        <GoLiveCelebration
          data={goLiveCelebration.data}
          notificationId={goLiveCelebration.notificationId}
          copy={{
            headline: tGoLive('headline'),
            subheadline: tGoLive('subheadline'),
            celebrationDays: tGoLive('celebrationDays'),
            celebrationDay: tGoLive('celebrationDay'),
            yourUrl: tGoLive('yourUrl'),
            viewSite: tGoLive('viewSite'),
            shareLinkedIn: tGoLive('shareLinkedIn'),
            dismiss: tGoLive('dismiss'),
            noCustomDomain: tGoLive('noCustomDomain'),
          }}
        />
      )}

      {activeTenant && !goLiveCelebration && (
        <PublishStatusBanner
          tenant={activeTenant}
          publicUrl={`/sites/${activeTenant.slug}`}
          copy={{
            ctaTitle: tPublish('ctaTitle'),
            ctaButton: tPublish('ctaButton'),
            confirmRequest: tPublish('confirmRequest'),
            pendingLabel: tPublish('pendingLabel'),
            pendingHint: tPublish('pendingHint'),
            cancelButton: tPublish('cancelButton'),
            confirmCancel: tPublish('confirmCancel'),
            approvedLabel: tPublish('approvedLabel'),
            viewSite: tPublish('viewSite'),
            rejectedLabel: tPublish('rejectedLabel'),
            rejectionNotesLabel: tPublish('rejectionNotesLabel'),
            resubmitButton: tPublish('resubmitButton'),
            errorGeneric: tPublish('errorGeneric'),
          }}
        />
      )}

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

      {checklistProgress && checklistProgress.total > 0 && (
        <Card size="sm" className="mt-6" data-testid="account-card-checklist">
          <CardHeader>
            <CardTitle className="text-sm">{tSetup('overviewTitle')}</CardTitle>
            <CardDescription className="text-xs">
              {tSetup('overviewSummary', {
                completed: checklistProgress.completed,
                total: checklistProgress.total,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChecklistProgressBar
              total={checklistProgress.total}
              completed={checklistProgress.completed}
              percentage={checklistProgress.percentageComplete}
              label={tSetup('progressLabel')}
            />
            <Link
              href="/account/setup"
              data-testid="link-setup"
              className="text-foreground hover:bg-muted ring-border inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
            >
              → {tSetup('viewSetup')}
            </Link>
          </CardContent>
        </Card>
      )}

      <Separator className="my-12" />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/account/connections"
          data-testid="link-connections"
          className="text-foreground hover:bg-muted ring-border inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
        >
          → {t('viewConnections')}
        </Link>
        <Link
          href="/account/media"
          data-testid="link-media"
          className="text-foreground hover:bg-muted ring-border inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
        >
          → {t('viewMedia')}
        </Link>
        {editorVisible && (
          <Link
            href="/account/site/pages"
            data-testid="link-editor"
            className="text-foreground hover:bg-muted ring-border inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
          >
            → {t('viewEditor')}
          </Link>
        )}
        {superAdmin && (
          <Link
            href="/admin/onboarding/new"
            data-testid="link-onboarding"
            className="text-foreground hover:bg-muted ring-border inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs ring-1 transition"
          >
            → Nieuwe klant onboarden
          </Link>
        )}
      </div>
      <p className="text-muted-foreground mt-3 font-mono text-xs">
        Mock auth — Supabase replacement scheduled for step 119/118.
      </p>
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
