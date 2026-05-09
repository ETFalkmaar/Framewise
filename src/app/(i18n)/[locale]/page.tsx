import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { type Locale } from '@/i18n/routing';

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('homepage');

  return (
    <main
      data-testid="homepage-hero"
      className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12"
    >
      {/* Subtle gradient backdrop */}
      <div
        aria-hidden
        className="from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
      />
      <div
        aria-hidden
        className="bg-primary/15 pointer-events-none absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <h1 className="text-display-xl sm:text-display-2xl font-bold tracking-tight">
          {t('title')}
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg sm:text-xl">{t('tagline')}</p>
        <Button size="lg" className="mt-4" disabled>
          {t('cta')}
        </Button>
      </div>

      <footer className="text-muted-foreground relative z-10 mt-20 text-sm">
        Framewise · Multi-tenant website builder with AI agent
      </footer>
    </main>
  );
}
