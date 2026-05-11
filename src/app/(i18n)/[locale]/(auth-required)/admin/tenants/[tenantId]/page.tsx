import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { TenantVisitRecorder } from '@/components/admin/switcher/tenant-visit-recorder';
import { AuditLogCard } from '@/components/admin/tenant-dashboard/audit-log-card';
import { ConnectionsCard } from '@/components/admin/tenant-dashboard/connections-card';
import { DashboardHeader } from '@/components/admin/tenant-dashboard/dashboard-header';
import { InlineActions } from '@/components/admin/tenant-dashboard/inline-actions';
import { PreviewCard } from '@/components/admin/tenant-dashboard/preview-card';
import { StatsOverview } from '@/components/admin/tenant-dashboard/stats-overview';
import {
  calculateTenantStats,
  currentServerEpochMs,
  getConnectionStatusForTenant,
  listRecentAuditEvents,
  type AuditAction,
} from '@/lib/admin';
import { PublishRequestCard } from '@/components/admin/publish-request-card';
import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { subscriptionsRepo, tenantsRepo, usersRepo } from '@/lib/data';
import type { Locale } from '@/i18n/routing';
import type { ConnectionCategory, TenantStatus } from '@/types/database';

/**
 * Per-tenant super-admin dashboard (step 36, fase 11).
 *
 * Fetches stats + recent activity + per-provider status in
 * parallel so the page renders in a single round-trip on the
 * mock adapter. Layout is a 2-column grid on lg+: audit log +
 * connections on the left, inline actions + preview on the
 * right. Mobile collapses to a single column.
 */
export default async function AdminTenantDashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale; tenantId: string }>;
}) {
  const { locale, tenantId } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isUserSuperAdmin(user.id)) redirect('/account');

  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) notFound();

  const [stats, auditEvents, connectors, subscription] = await Promise.all([
    calculateTenantStats(tenant.id),
    listRecentAuditEvents({ tenantId: tenant.id, limit: 20 }),
    getConnectionStatusForTenant(tenant.id),
    subscriptionsRepo.findByTenant(tenant.id),
  ]);

  const plan = subscription ? await subscriptionsRepo.findPlanById(subscription.plan_id) : null;
  const renderedAtMs = currentServerEpochMs();

  const tStatus = await getTranslations('admin.tenants.status');
  const t = await getTranslations('admin.tenantDashboard');
  const tAuditActions = await getTranslations('admin.tenantDashboard.auditActions');
  const tCategory = await getTranslations('admin.tenantDashboard.categoryLabels');
  const tPublish = await getTranslations('admin.publish');

  // Step 47 — surface a pending publish request prominently at the
  // top of the dashboard so the super-admin notices it before they
  // dive into stats / audit / connections.
  const publishRequester =
    tenant.publish_request_status === 'pending' && tenant.publish_requested_by_user_id
      ? await usersRepo.findById(tenant.publish_requested_by_user_id)
      : null;

  const statusLabels: Record<TenantStatus, string> = {
    onboarding: tStatus('onboarding'),
    live: tStatus('live'),
    paused: tStatus('paused'),
    cancelled: tStatus('cancelled'),
  };

  const auditActionLabels: Record<AuditAction, string> = {
    tenant_created: tAuditActions('tenant_created'),
    tenant_updated: tAuditActions('tenant_updated'),
    site_published: tAuditActions('site_published'),
    site_unpublished: tAuditActions('site_unpublished'),
    connection_added: tAuditActions('connection_added'),
    connection_removed: tAuditActions('connection_removed'),
    domain_added: tAuditActions('domain_added'),
    domain_verified: tAuditActions('domain_verified'),
    checklist_item_completed: tAuditActions('checklist_item_completed'),
    member_invited: tAuditActions('member_invited'),
  };

  const categoryLabels: Record<ConnectionCategory, string> = {
    accounting: tCategory('accounting'),
    payments: tCategory('payments'),
    crm: tCategory('crm'),
    newsletter: tCategory('newsletter'),
    phone: tCategory('phone'),
  };

  return (
    <main
      data-testid="tenant-dashboard"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-12"
    >
      <TenantVisitRecorder tenantId={tenant.id} />
      <DashboardHeader
        tenant={tenant}
        planCode={plan?.code ?? null}
        daysOld={stats?.daysOld ?? 0}
        copy={{
          statusLabels,
          openSite: t('openSite'),
          setupChecklist: t('setupChecklist'),
          domain: t('domain'),
          maintenance: t('maintenance'),
          emailLog: t('emailLog'),
        }}
      />

      <PublishRequestCard
        tenant={tenant}
        requestedBy={publishRequester}
        previewUrl={`/sites/${tenant.slug}?preview=true&pageId=${tenant.id}`}
        copy={{
          cardTitle: tPublish('cardTitle'),
          requestedBy: tPublish('requestedBy'),
          requestedAt: tPublish('requestedAt'),
          previewSite: tPublish('previewSite'),
          approveButton: tPublish('approveButton'),
          approveModalTitle: tPublish('approveModalTitle'),
          approveModalBody: tPublish('approveModalBody'),
          approveNotesLabel: tPublish('approveNotesLabel'),
          approveSubmit: tPublish('approveSubmit'),
          rejectButton: tPublish('rejectButton'),
          rejectModalTitle: tPublish('rejectModalTitle'),
          rejectModalBody: tPublish('rejectModalBody'),
          rejectNotesLabel: tPublish('rejectNotesLabel'),
          rejectNotesPlaceholder: tPublish('rejectNotesPlaceholder'),
          rejectNotesHint: tPublish('rejectNotesHint'),
          rejectNotesShort: tPublish('rejectNotesShort'),
          rejectSubmit: tPublish('rejectSubmit'),
          cancel: tPublish('cancel'),
          errorGeneric: tPublish('errorGeneric'),
        }}
      />

      <StatsOverview
        stats={stats}
        copy={{
          checklistProgress: t('stats.checklistProgress'),
          activeConnectors: t('stats.activeConnectors'),
          daysActive: t('stats.daysActive'),
          canGoLive: t('stats.canGoLive'),
          canGoLiveYes: t('stats.canGoLiveYes'),
          canGoLiveNo: t('stats.canGoLiveNo'),
        }}
      />

      <div className="mt-2 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AuditLogCard
            events={auditEvents}
            now={renderedAtMs}
            tenantId={tenant.id}
            copy={{
              title: t('auditLog.title'),
              empty: t('auditLog.empty'),
              by: t('auditLog.by'),
              ago: t('auditLog.ago'),
              viewAll: t('auditLog.viewAll'),
              actionLabels: auditActionLabels,
            }}
          />

          <ConnectionsCard
            connectors={connectors}
            copy={{
              title: t('connections.title'),
              connected: t('connections.connected'),
              notConnected: t('connections.notConnected'),
              error: t('connections.error'),
              lastSync: t('connections.lastSync'),
              configure: t('connections.configure'),
              categoryLabels,
            }}
          />
        </div>

        <div className="space-y-6">
          <InlineActions
            tenantStatus={tenant.status}
            canPublish={stats?.canGoLive ?? false}
            copy={{
              title: t('actions.title'),
              publishCta: t('actions.publish'),
              unpublishCta: t('actions.unpublish'),
              publishing: t('actions.publishing'),
              unpublishing: t('actions.unpublishing'),
              blockedHint: t('actions.blockedHint'),
              liveLabel: t('actions.liveLabel'),
              cancelledLabel: t('actions.cancelledLabel'),
              confirmUnpublish: t('actions.confirmUnpublish'),
            }}
          />

          <PreviewCard
            tenant={tenant}
            copy={{
              title: t('preview.title'),
              openInNewTab: t('preview.openInNewTab'),
              maintenanceMode: t('preview.maintenanceMode'),
              cancelled: t('preview.cancelled'),
            }}
          />
        </div>
      </div>
    </main>
  );
}
