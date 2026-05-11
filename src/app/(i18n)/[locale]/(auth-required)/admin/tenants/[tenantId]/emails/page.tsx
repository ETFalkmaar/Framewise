import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { auditLogsRepo, tenantsRepo } from '@/lib/data';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { AuditLog } from '@/types/database';

/**
 * Super-admin email log viewer (step 52, fase 14 part 4/7). Pulls
 * every `email_queued` audit entry for a tenant and renders the
 * subject + recipient + event metadata in a compact table — gives
 * the operator a quick way to verify a customer actually got their
 * confirmation without digging through the generic audit log.
 *
 * Step 21 will wire the real email provider; the same audit-trail
 * approach keeps working because the email-stub interface stays
 * the same — we just gain delivery status.
 */
export default async function TenantEmailLogPage({
  params,
}: {
  params: Promise<{ locale: Locale; tenantId: string }>;
}) {
  const { locale, tenantId } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const isSuperAdmin = await isUserSuperAdmin(user.id);
  if (!isSuperAdmin) notFound();

  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) notFound();

  // Fetch the full audit log for this tenant, then filter to the
  // email events. The mock adapter doesn't support an action filter
  // server-side; Supabase swap (step 119) will add a proper WHERE
  // clause. Cap at 200 — anything older is rare to need anyway.
  const allEvents = await auditLogsRepo.listByTenant(tenantId, { limit: 500 });
  const emailEvents = allEvents.filter((e) => e.action === 'email_queued').slice(0, 200);

  const t = await getTranslations('adminEmailLog');

  return (
    <main
      data-testid="admin-email-log"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href={`/admin/tenants/${tenantId}`}
          data-testid="back-to-tenant"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {tenant.name}
        </Link>
        <h1 className="text-display-md mt-2 font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t('subtitle').replace('{tenant}', tenant.name)}
        </p>
      </header>

      {emailEvents.length === 0 ? (
        <p
          data-testid="email-log-empty"
          className="text-muted-foreground py-12 text-center text-sm"
        >
          {t('empty')}
        </p>
      ) : (
        <table
          className="border-border w-full border-collapse border text-sm"
          data-testid="email-log-table"
        >
          <thead className="bg-muted/40">
            <tr>
              <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                {t('columns.sentAt')}
              </th>
              <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                {t('columns.to')}
              </th>
              <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                {t('columns.subject')}
              </th>
              <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                {t('columns.event')}
              </th>
              <th className="border-border border-b p-2 text-left font-mono text-xs uppercase">
                {t('columns.recipient')}
              </th>
            </tr>
          </thead>
          <tbody>
            {emailEvents.map((event) => (
              <EmailRow key={event.id} event={event} locale={locale} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function EmailRow({ event, locale }: { event: AuditLog; locale: string }): React.ReactElement {
  const meta = (event.metadata ?? {}) as {
    to?: string;
    subject?: string;
    recipient?: string;
    event?: string;
    reference?: string;
  };
  const when = new Date(event.created_at).toLocaleString(
    locale === 'nl' ? 'nl-NL' : locale === 'fr' ? 'fr-FR' : 'en-US',
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }
  );

  return (
    <tr data-testid={`email-row-${event.id}`} className="border-border hover:bg-muted/30 border-b">
      <td className="border-border border-r p-2 font-mono text-xs">{when}</td>
      <td className="border-border border-r p-2 text-xs">{meta.to ?? '—'}</td>
      <td className="border-border border-r p-2 text-xs">{meta.subject ?? '—'}</td>
      <td className="border-border border-r p-2 font-mono text-[10px] uppercase">
        {meta.event ?? '—'}
      </td>
      <td className="p-2 font-mono text-[10px] uppercase">{meta.recipient ?? '—'}</td>
    </tr>
  );
}
