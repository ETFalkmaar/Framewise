import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Stepped onboarding visuals for the Stripe Connect connector.
 * Renders above the OAuth button on `/account/connections/add/stripe`.
 *
 * Includes a BYOA disclaimer (money lands on the CUSTOMER's Stripe
 * account, not Framewise's) and a test/live mode warning — both
 * crucial for a payment provider where misunderstanding the model
 * can lead to confusion or surprise charges.
 */
export async function StripeInstructions(): Promise<React.JSX.Element> {
  const t = await getTranslations('account.connections.providers.stripe');

  return (
    <Card size="sm" data-testid="stripe-instructions" className="mb-6">
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
        <div className="grid gap-2 sm:grid-cols-2">
          <p
            data-testid="stripe-byoa-disclaimer"
            className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 leading-snug text-emerald-700 dark:text-emerald-300"
          >
            <span className="block font-mono font-semibold">BYOA</span>
            {t('byoaDisclaimer')}
          </p>
          <p
            data-testid="stripe-mode-warning"
            className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 leading-snug text-amber-700 dark:text-amber-300"
          >
            <span className="block font-mono font-semibold">test ↔ live</span>
            {t('modeWarning')}
          </p>
        </div>
        <p className="text-muted-foreground italic">{t('instructions.tip')}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Banner shown when STRIPE_CLIENT_ID / STRIPE_SECRET_KEY env vars are
 * blank — the OAuth handshake cannot complete, so we replace the
 * button with a clear "Framewise needs to configure this" message.
 */
export async function StripeConfigWarning(): Promise<React.JSX.Element> {
  const t = await getTranslations('account.connections.providers.stripe');

  return (
    <Card
      size="sm"
      data-testid="stripe-config-warning"
      className="mb-6 border-amber-500/40 bg-amber-500/5"
    >
      <CardHeader>
        <CardTitle className="text-sm text-amber-700 dark:text-amber-300">
          {t('configWarningTitle')}
        </CardTitle>
        <CardDescription className="text-xs text-amber-700/80 dark:text-amber-300/80">
          {t('configWarning')}
        </CardDescription>
      </CardHeader>
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
