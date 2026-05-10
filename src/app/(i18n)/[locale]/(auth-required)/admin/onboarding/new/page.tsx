import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getCurrentUser, isUserSuperAdmin } from '@/lib/auth';
import type { Locale } from '@/i18n/routing';

import { OnboardingWizard } from './wizard';

/**
 * Super-admin onboarding wizard entry (step 30, fase 10).
 *
 * The `(auth-required)` layout already redirects unauthenticated
 * visitors to `/login`. This page additionally gates on the
 * super-admin id — `isUserSuperAdmin()` is a strict equality
 * against the seeded admin uuid, so a customer's `owner` user
 * lands on `/account` (302) instead of seeing the wizard.
 */
export default async function OnboardingNewPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isUserSuperAdmin(user.id)) redirect('/account');

  return (
    <main
      data-testid="onboarding-page"
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12"
    >
      <header className="mb-8">
        <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
          Super-admin
        </p>
        <h1 className="text-display-md mt-1 font-bold tracking-tight">Nieuwe klant onboarden</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Maak een tenant + owner-account aan. Het tijdelijke wachtwoord wordt eenmalig getoond op
          de bevestigingspagina; kopieer het direct naar de klant.
        </p>
      </header>

      <OnboardingWizard />
    </main>
  );
}
