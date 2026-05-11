import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AvailabilityPageClient } from '@/components/bookings/availability-page-client';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getActiveTenantForUser, getCurrentUser } from '@/lib/auth';
import { availabilityRulesRepo, bookingExceptionsRepo } from '@/lib/data';
import { canManageBookings } from '@/lib/permissions/bookings';

/**
 * Availability management page (step 50). Gated to tenant owners +
 * super-admin on Enterprise tenants with `bookings_enabled` flipped on.
 * The page is server-rendered + hands a snapshot of rules + upcoming
 * exceptions to a thin client wrapper that owns the form modals.
 */
export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const tenant = await getActiveTenantForUser();
  if (!tenant) notFound();

  const allowed = await canManageBookings(user.id, tenant);
  if (!allowed) notFound();

  // Look ahead 90 days for exceptions — keeps the UI focused on the
  // near-term; older exceptions stay in the audit log.
  const today = new Date();
  const horizon = new Date();
  horizon.setDate(today.getDate() + 90);
  const toIso = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate()
    ).padStart(2, '0')}`;

  const [rules, exceptions] = await Promise.all([
    availabilityRulesRepo.listByTenant(tenant.id),
    bookingExceptionsRepo.listByTenant(tenant.id, {
      from: toIso(today),
      to: toIso(horizon),
    }),
  ]);

  const t = await getTranslations('bookings.availability');

  const dayNames = [
    t('days.0'),
    t('days.1'),
    t('days.2'),
    t('days.3'),
    t('days.4'),
    t('days.5'),
    t('days.6'),
  ];

  return (
    <main
      data-testid="availability-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <Link
          href="/account/bookings"
          data-testid="back-to-bookings"
          className="text-muted-foreground font-mono text-xs hover:underline"
        >
          ← {t('backToBookings')}
        </Link>
        <h1 className="text-display-md mt-2 font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
      </header>

      <h2 className="mb-2 text-lg font-semibold">{t('rulesSection')}</h2>
      <p className="text-muted-foreground mb-4 text-xs font-mono">
        {/* Spacer to give the section a defined column before the list renders inline. */}
      </p>

      <AvailabilityPageClient
        rules={rules}
        exceptions={exceptions}
        copy={{
          addRule: t('addRule'),
          addException: t('addException'),
          rulesEmpty: t('rulesEmpty'),
          exceptionsEmpty: t('exceptionsEmpty'),
          activeLabel: t('ruleCard.active'),
          inactiveLabel: t('ruleCard.inactive'),
          durationFmt: t('ruleCard.duration'),
          capacityFmt: t('ruleCard.capacity'),
          partyFmt: t('ruleCard.maxPartySize'),
          bufferFmt: t('ruleCard.buffer'),
          edit: t('ruleCard.edit'),
          deleteLabel: t('ruleCard.delete'),
          deactivate: t('ruleCard.deactivate'),
          activate: t('ruleCard.activate'),
          deleteConfirm: t('form.deleteConfirm'),
          errorGeneric: t('form.errorStartAfterEnd'),
          closedBadge: t('exception.card.closed'),
          customTimesFmt: t('exception.card.customTimes'),
          dayNames,
          ruleFormCopy: {
            title: t('form.title'),
            editTitle: t('form.editTitle'),
            name: t('form.name'),
            namePlaceholder: t('form.namePlaceholder'),
            dayOfWeek: t('form.dayOfWeek'),
            startTime: t('form.startTime'),
            endTime: t('form.endTime'),
            slotDuration: t('form.slotDuration'),
            slotDurationHint: t('form.slotDurationHint'),
            maxPartySize: t('form.maxPartySize'),
            maxConcurrent: t('form.maxConcurrent'),
            bufferMinutes: t('form.bufferMinutes'),
            bufferHint: t('form.bufferHint'),
            save: t('form.save'),
            cancel: t('form.cancel'),
            errorStartAfterEnd: t('form.errorStartAfterEnd'),
            errorGeneric: t('form.errorStartAfterEnd'),
            dayNames,
          },
          exceptionFormCopy: {
            title: t('exception.form.title'),
            date: t('exception.form.date'),
            reason: t('exception.form.reason'),
            reasonPlaceholder: t('exception.form.reasonPlaceholder'),
            isClosed: t('exception.form.isClosed'),
            isClosedHint: t('exception.form.isClosedHint'),
            customStartTime: t('exception.form.customStartTime'),
            customEndTime: t('exception.form.customEndTime'),
            save: t('exception.form.save'),
            cancel: t('form.cancel'),
            errorGeneric: t('form.errorStartAfterEnd'),
          },
        }}
      />
    </main>
  );
}
