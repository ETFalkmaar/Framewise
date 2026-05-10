import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from '@/components/ui/sonner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { MaintenancePage } from '@/components/maintenance-page';
import { routing, type Locale } from '@/i18n/routing';
import { getCurrentTenantWithSubscription } from '@/lib/tenant';
import { TenantProvider } from '@/lib/tenant/client-context';
import {
  AuthProvider,
  getActiveTenantForUser,
  getCurrentUserWithTenants,
  isUserSuperAdmin,
  toPublicUser,
} from '@/lib/auth';
import '../../globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homepage' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      languages: {
        nl: '/',
        fr: '/fr',
        en: '/en',
      },
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0a0e1a',
  colorScheme: 'dark',
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const [tenantContext, authContext, activeTenant] = await Promise.all([
    getCurrentTenantWithSubscription(),
    getCurrentUserWithTenants(),
    getActiveTenantForUser(),
  ]);

  const tenant = tenantContext?.tenant ?? null;
  const plan = tenantContext?.plan ?? null;
  const subscription = tenantContext?.subscription ?? null;

  // Step 32: super-admin bypasses the maintenance shell so they can
  // preview / fix a tenant site that's still in onboarding or
  // paused for an emergency repair.
  const viewerIsSuperAdmin = authContext !== null && isUserSuperAdmin(authContext.user.id);
  const showMaintenance =
    tenant !== null &&
    !viewerIsSuperAdmin &&
    (tenant.status === 'onboarding' || tenant.status === 'paused');

  return (
    <html
      lang={locale}
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <NextIntlClientProvider>
          <AuthProvider
            user={authContext ? toPublicUser(authContext.user) : null}
            tenants={authContext?.tenants ?? []}
            activeTenantId={activeTenant?.id ?? null}
          >
            <TenantProvider tenant={tenant} plan={plan} subscription={subscription}>
              <header className="absolute top-0 right-0 z-20 p-4 sm:p-6">
                <LanguageSwitcher />
              </header>
              {showMaintenance ? (
                <MaintenancePage tenant={tenant!} locale={locale as 'nl' | 'fr' | 'en'} />
              ) : (
                children
              )}
              <Toaster richColors theme="dark" />
            </TenantProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
