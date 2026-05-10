import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { tenantsRepo } from '@/lib/data';
import type { Locale } from '@/i18n/routing';

import { MaintenanceSettingsForm } from './form';

/**
 * Super-admin tool to customise the branded maintenance page
 * (step 34). Renders a settings form with the current values
 * pre-populated; submitting calls the server action which writes
 * back to `tenants`.
 */
export default async function MaintenanceSettingsPage({
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

  return (
    <main
      data-testid="maintenance-settings-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Super-admin · {tenant.name}
        </p>
        <h1 className="text-display-md mt-1 font-bold tracking-tight">
          Onderhoudspagina instellen
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Bezoekers zien deze pagina wanneer de site op `paused` of `onboarding` staat. Logo en
          bericht zijn optioneel — leeg laten valt terug op een Framewise default.
        </p>
      </header>

      <MaintenanceSettingsForm
        tenantId={tenant.id}
        initial={{
          messageNl: tenant.maintenance_message_translations?.nl ?? '',
          messageFr: tenant.maintenance_message_translations?.fr ?? '',
          messageEn: tenant.maintenance_message_translations?.en ?? '',
          logoUrl: tenant.maintenance_logo_url ?? '',
          contactEmail: tenant.maintenance_contact_email ?? '',
        }}
      />
    </main>
  );
}
