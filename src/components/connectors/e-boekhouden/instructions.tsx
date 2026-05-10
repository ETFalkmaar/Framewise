import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Stepped onboarding visuals for the e-Boekhouden connector.
 * Rendered above the API-key wizard on
 * `/account/connections/add/e-boekhouden`.
 */
export async function EBoekhoudenInstructions(): Promise<React.JSX.Element> {
  const t = await getTranslations('account.connections.providers.e-boekhouden');

  const sourceTokenWarning = t('sourceTokenWarning');
  const sourceTokenConfigured = Boolean(process.env.EBOEKHOUDEN_SOURCE_API_TOKEN);

  return (
    <Card size="sm" data-testid="e-boekhouden-instructions" className="mb-6">
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
          <Step n={5} text={t('instructions.step5')} />
        </ol>
        <Separator />
        {!sourceTokenConfigured && (
          <p
            data-testid="e-boekhouden-source-token-warning"
            className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 leading-snug text-amber-700 dark:text-amber-300"
          >
            ⚠ {sourceTokenWarning}
          </p>
        )}
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
