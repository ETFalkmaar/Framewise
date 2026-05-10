import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';

import { getActiveTenantForUser } from '@/lib/auth';
import {
  getConnector,
  getHubSpotOAuthConfig,
  getMailchimpOAuthConfig,
  getPayPalOAuthConfig,
  getPipedriveOAuthConfig,
  getStripeOAuthConfig,
} from '@/lib/connectors';
import { getProviderById } from '@/lib/countries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { ApiKeyWizard } from '@/components/connectors/api-key-wizard';
import { OAuthButton } from '@/components/connectors/oauth-button';
import { MoneybirdInstructions } from '@/components/connectors/moneybird/instructions';
import { EBoekhoudenInstructions } from '@/components/connectors/e-boekhouden/instructions';
import { MollieInstructions } from '@/components/connectors/mollie/instructions';
import {
  StripeConfigWarning,
  StripeInstructions,
} from '@/components/connectors/stripe/instructions';
import {
  PayPalConfigWarning,
  PayPalInstructions,
} from '@/components/connectors/paypal/instructions';
import {
  HubSpotConfigWarning,
  HubSpotInstructions,
} from '@/components/connectors/hubspot/instructions';
import {
  PipedriveConfigWarning,
  PipedriveInstructions,
} from '@/components/connectors/pipedrive/instructions';
import { BrevoInstructions } from '@/components/connectors/brevo/instructions';
import {
  MailchimpConfigWarning,
  MailchimpInstructions,
} from '@/components/connectors/mailchimp/instructions';

export default async function ConnectorConnectPage({
  params,
}: {
  params: Promise<{ locale: Locale; providerId: string }>;
}) {
  const { locale, providerId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('account.connections');
  const connector = getConnector(providerId);
  if (!connector) notFound();

  // Hide developmentOnly connectors in production.
  if (connector.developmentOnly && process.env.NODE_ENV === 'production') {
    notFound();
  }

  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    return (
      <main
        data-testid="connect-page"
        className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-md flex-col px-6 py-24"
      >
        <header className="mb-10">
          <Badge variant="outline" className="font-mono">
            /account/connections/add/{providerId}
          </Badge>
          <h1 className="text-display-lg mt-3 font-bold tracking-tight">
            {t('connectFlow.apiKeyTitle')}
          </h1>
        </header>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t('noTenant')}</CardTitle>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const meta = getProviderById(connector.id);
  const providerName = meta?.name ?? connector.id;
  const description = meta?.description[locale] ?? '';

  return (
    <main
      data-testid="connect-page"
      data-provider-id={connector.id}
      data-auth-method={connector.authMethod}
      className="bg-background text-foreground mx-auto flex min-h-screen max-w-screen-md flex-col px-6 py-16"
    >
      <header className="mb-8">
        <Badge variant="outline" className="font-mono">
          /account/connections/add/{connector.id}
        </Badge>
        <h1 className="text-display-lg mt-3 font-bold tracking-tight">{providerName}</h1>
        {description && <p className="text-muted-foreground mt-2 text-sm">{description}</p>}
        <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
          <Badge variant="secondary">{tenant.country}</Badge>
          <Badge variant="outline">
            {connector.authMethod === 'oauth' ? '🔐 OAuth' : '🗝️ API key'}
          </Badge>
          {connector.developmentOnly && <Badge variant="outline">{t('addPage.devOnly')}</Badge>}
        </div>
      </header>

      <Card size="sm" className="mb-6">
        <CardContent className="text-muted-foreground py-3 text-xs leading-snug">
          {t('byoaDisclaimer')}
        </CardContent>
      </Card>

      {connector.id === 'stripe' && <StripeInstructions />}
      {connector.id === 'paypal-business' && <PayPalInstructions />}
      {connector.id === 'hubspot' && <HubSpotInstructions />}
      {connector.id === 'pipedrive' && <PipedriveInstructions />}
      {connector.id === 'mailchimp' && <MailchimpInstructions />}

      {connector.authMethod === 'oauth' && (
        <section data-testid="oauth-flow">
          {connector.id === 'stripe' && getStripeOAuthConfig() === null && <StripeConfigWarning />}
          {connector.id === 'paypal-business' && getPayPalOAuthConfig() === null && (
            <PayPalConfigWarning />
          )}
          {connector.id === 'hubspot' && getHubSpotOAuthConfig() === null && (
            <HubSpotConfigWarning />
          )}
          {connector.id === 'pipedrive' && getPipedriveOAuthConfig() === null && (
            <PipedriveConfigWarning />
          )}
          {connector.id === 'mailchimp' && getMailchimpOAuthConfig() === null && (
            <MailchimpConfigWarning />
          )}
          <OAuthButton
            providerId={connector.id}
            copy={{
              start: t('connectFlow.oauthStart', { provider: providerName }),
              starting: t('connectFlow.oauthRedirecting'),
              failed: t('connectFlow.testFailed'),
            }}
            disabled={
              (connector.id === 'stripe' && getStripeOAuthConfig() === null) ||
              (connector.id === 'paypal-business' && getPayPalOAuthConfig() === null) ||
              (connector.id === 'hubspot' && getHubSpotOAuthConfig() === null) ||
              (connector.id === 'pipedrive' && getPipedriveOAuthConfig() === null) ||
              (connector.id === 'mailchimp' && getMailchimpOAuthConfig() === null)
            }
          />
        </section>
      )}

      {connector.id === 'moneybird' && <MoneybirdInstructions />}
      {connector.id === 'e-boekhouden' && <EBoekhoudenInstructions />}
      {connector.id === 'mollie' && <MollieInstructions />}
      {connector.id === 'brevo' && <BrevoInstructions />}

      {connector.authMethod === 'api_key' && connector.apiKey && (
        <section data-testid="api-key-flow">
          <ApiKeyWizard
            providerId={connector.id}
            fields={connector.apiKey.fields}
            instructions={connector.apiKey.instructions[locale]}
            helpUrl={connector.apiKey.helpUrl}
            locale={locale}
            copy={{
              title: t('connectFlow.apiKeyTitle'),
              submit: t('connectFlow.apiKeySubmit'),
              submitting: t('connectFlow.testing'),
              testing: t('connectFlow.testing'),
              success: t('connectFlow.success'),
              successHint: t('connectFlow.successHint'),
              testFailed: t('connectFlow.testFailed'),
              fieldRequired: t('connectFlow.fieldRequired'),
              helpLinkLabel: t('connectFlow.helpLinkLabel'),
              cancel: t('connectFlow.cancel'),
            }}
          />
        </section>
      )}

      <Separator className="my-12" />
      <p className="text-muted-foreground font-mono text-xs">
        <Link href="/account/connections/add" className="hover:text-foreground underline">
          ← {t('addPage.title')}
        </Link>
      </p>
    </main>
  );
}
