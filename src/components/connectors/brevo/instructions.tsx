import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Stepped onboarding visuals for the Brevo connector. Renders above
 * the API-key wizard on `/account/connections/add/brevo`.
 *
 * Includes a Free CRM-style notice (Brevo's free tier covers 300
 * emails/day with unlimited contacts), a Sendinblue-rebrand note
 * for older customers, a GDPR / EU-hosting positioning hint, and a
 * BYOA disclaimer.
 */
export async function BrevoInstructions(): Promise<React.JSX.Element> {
  const t = await getTranslations('account.connections.providers.brevo');

  return (
    <Card size="sm" data-testid="brevo-instructions" className="mb-6">
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
            data-testid="brevo-free-tier-notice"
            className="rounded-md border border-blue-500/40 bg-blue-500/5 px-3 py-2 leading-snug text-blue-700 dark:text-blue-300"
          >
            <span className="block font-mono font-semibold">Free tier</span>
            {t('freeTierNotice')}
          </p>
          <p
            data-testid="brevo-byoa-disclaimer"
            className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 leading-snug text-emerald-700 dark:text-emerald-300"
          >
            <span className="block font-mono font-semibold">BYOA</span>
            {t('byoaDisclaimer')}
          </p>
        </div>
        <p
          data-testid="brevo-gdpr-notice"
          className="text-muted-foreground rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 leading-snug"
        >
          🇪🇺 <span className="font-semibold">GDPR:</span> {t('gdprCompliant')}
        </p>
        <p
          data-testid="brevo-rebrand-notice"
          className="text-muted-foreground rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 leading-snug"
        >
          ℹ️ <span className="font-semibold">{t('rebrandTitle')}:</span> {t('sendinblueRebrand')}
        </p>
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
