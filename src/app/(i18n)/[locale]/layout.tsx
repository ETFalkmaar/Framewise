import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from '@/components/ui/sonner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { routing, type Locale } from '@/i18n/routing';
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

  return (
    <html
      lang={locale}
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <NextIntlClientProvider>
          <header className="absolute top-0 right-0 z-20 p-4 sm:p-6">
            <LanguageSwitcher />
          </header>
          {children}
          <Toaster richColors theme="dark" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
