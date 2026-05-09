import type { CountryConfig } from './types';

const cw: CountryConfig = {
  code: 'CW',
  name: {
    nl: 'Curaçao',
    fr: 'Curaçao',
    en: 'Curaçao',
  },
  flagEmoji: '🇨🇼',
  defaultLocale: 'nl',
  availableLocales: ['nl', 'en'],
  defaultCurrency: 'ANG',
  supportedCurrencies: ['ANG', 'USD', 'EUR'],
  timezone: 'America/Curacao',
  taxIdentifier: {
    name: 'CRIB-nummer',
    fieldKey: 'crib_number',
    format: {
      nl: 'Negen cijfers (bv. 123456789).',
      fr: 'Neuf chiffres (ex. 123456789).',
      en: 'Nine digits (e.g. 123456789).',
    },
    regex: '^\\d{9}$',
  },
  providers: {
    accounting: ['xero', 'quickbooks', 'bdo-online'],
    payments: ['stripe', 'paypal-business'],
    phone: ['telnyx'],
    crm: ['hubspot', 'pipedrive'],
    newsletter: ['brevo', 'mailchimp'],
  },
  legalRequirements: [
    {
      category: 'accounting',
      requiredAtLaunch: true,
      description: {
        nl: 'CRIB-nummer en KvK Curaçao-nummer verplicht op facturen; OB-tarief 6% voor diensten.',
        fr: "Numéro CRIB et numéro KvK Curaçao obligatoires sur les factures ; taux d'OB de 6 % pour les services.",
        en: 'CRIB number and Curaçao KvK number required on invoices; turnover tax (OB) 6% for services.',
      },
    },
    {
      category: 'payments',
      requiredAtLaunch: false,
      description: {
        nl: 'Geen verplichte cookie-banner zoals in EU, maar GDPR geldt zodra je EU-bezoekers verwerkt.',
        fr: "Pas de bandeau cookies obligatoire comme dans l'UE, mais le RGPD s'applique dès que vous traitez des visiteurs européens.",
        en: 'No mandatory EU-style cookie banner, but GDPR still applies if you process EU visitors.',
      },
    },
  ],
  notes: {
    nl: 'Stripe vereist Atlas of EU-entiteit; voor zuiver lokale acceptatie is een lokale acquirer (MCB/CMB) vaak handiger.',
    fr: "Stripe nécessite Atlas ou une entité UE ; pour l'acceptation purement locale, un acquéreur local (MCB/CMB) est souvent plus pratique.",
    en: 'Stripe requires Atlas or an EU entity; for purely local card acceptance a local acquirer (MCB/CMB) is often more convenient.',
  },
};

export default cw;
