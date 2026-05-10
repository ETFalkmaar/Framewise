import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Stepped onboarding visuals for the Mollie connector. Renders
 * above the API-key wizard on `/account/connections/add/mollie`.
 *
 * Includes a side-by-side warning about test vs. live keys —
 * crucial for a payment provider where the wrong key type can
 * lead to either no real revenue (live in test mode) or surprise
 * production charges during a demo (test in live mode).
 */
export async function MollieInstructions(): Promise<React.JSX.Element> {
  const t = await getTranslations('account.connections.providers.mollie');

  return (
    <Card size="sm" data-testid="mollie-instructions" className="mb-6">
      <CardHeader>
        <CardTitle className="text-sm">{t('instructions.title')}</CardTitle>
        <CardDescription className="text-xs">{t('instructions.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <ol className="space-y-3">
          <Step n={1} text={t('instructions.step1')} />
          <Step n={2} text={t('instructions.step2')} />
          <Step n={3} text={t('instructions.step3')} />
          <Step n={4} text={t('instructions.step4')} />
        </ol>
        <Separator />
        <div className="grid gap-2 sm:grid-cols-2">
          <p
            data-testid="mollie-test-key-warning"
            className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 leading-snug text-amber-700 dark:text-amber-300"
          >
            <span className="block font-mono font-semibold">test_…</span>
            {t('testKeyWarning')}
          </p>
          <p
            data-testid="mollie-live-key-warning"
            className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 leading-snug text-emerald-700 dark:text-emerald-300"
          >
            <span className="block font-mono font-semibold">live_…</span>
            {t('liveKeyWarning')}
          </p>
        </div>
        <p className="text-muted-foreground italic">{t('instructions.tip')}</p>
      </CardContent>
    </Card>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="bg-primary/10 text-primary inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold">
        {n}
      </span>
      <span className="text-foreground/90 pt-0.5 leading-snug">{text}</span>
    </li>
  );
}
