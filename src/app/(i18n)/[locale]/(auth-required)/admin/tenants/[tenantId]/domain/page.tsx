import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import { tenantsRepo } from '@/lib/data';
import type { Locale } from '@/i18n/routing';

import { DomainWizard } from './wizard';

/**
 * Super-admin–only domain wizard (step 33). Renders a four-step
 * flow on the same page (state lives client-side):
 *   1. enter the domain
 *   2. show DNS records the customer must add at their registrar
 *   3. "check verification" → poll the Vercel client
 *   4. success card when status reaches `active`
 *
 * The page-level guard mirrors the onboarding wizard (step 30):
 * unauthenticated → `/login`, non-admin → `/account`.
 */
export default async function DomainWizardPage({
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
      data-testid="domain-wizard-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Super-admin · {tenant.name}
        </p>
        <h1 className="text-display-md mt-1 font-bold tracking-tight">Domein koppelen</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Registreer een eigen domein voor deze tenant en wacht tot Vercel de DNS records
          gevalideerd heeft. Zodra het domein `active` is, kan de site live via dat adres.
        </p>
      </header>

      <DomainWizard tenantId={tenantId} currentDomain={tenant.custom_domain ?? null} />
    </main>
  );
}
