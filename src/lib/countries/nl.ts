import type { CountryConfig } from './types';

const nl: CountryConfig = {
  code: 'NL',
  name: {
    nl: 'Nederland',
    fr: 'Pays-Bas',
    en: 'Netherlands',
  },
  flagEmoji: '🇳🇱',
  defaultLocale: 'nl',
  availableLocales: ['nl', 'en'],
  defaultCurrency: 'EUR',
  supportedCurrencies: ['EUR'],
  timezone: 'Europe/Amsterdam',
  taxIdentifier: {
    name: 'BTW-nummer',
    fieldKey: 'vat_number',
    format: {
      nl: 'NL gevolgd door 9 cijfers, B en 2 cijfers (bv. NL123456789B01).',
      fr: 'NL suivi de 9 chiffres, B et 2 chiffres (ex. NL123456789B01).',
      en: 'NL followed by 9 digits, B and 2 digits (e.g. NL123456789B01).',
    },
    regex: '^NL\\d{9}B\\d{2}$',
  },
  providers: {
    accounting: ['moneybird', 'e-boekhouden', 'exact-online', 'twinfield'],
    payments: ['stripe', 'mollie', 'paypal-business'],
    phone: ['twilio'],
    crm: ['hubspot', 'pipedrive'],
    newsletter: ['brevo', 'mailchimp'],
  },
  legalRequirements: [
    {
      category: 'accounting',
      requiredAtLaunch: true,
      description: {
        nl: 'BTW-nummer en KvK-nummer verplicht op facturen en in de footer voor B2B-verkoop.',
        fr: 'Numéro de TVA et numéro KvK obligatoires sur les factures et dans le pied de page pour la vente B2B.',
        en: 'VAT number and KvK (Chamber of Commerce) number required on invoices and in the footer for B2B sales.',
      },
    },
    {
      category: 'payments',
      requiredAtLaunch: true,
      description: {
        nl: 'Cookie-banner verplicht voor analytics; expliciete opt-in voor niet-functionele cookies.',
        fr: 'Bandeau cookies obligatoire pour les analyses ; opt-in explicite pour les cookies non-essentiels.',
        en: 'Cookie banner required for analytics; explicit opt-in for non-essential cookies.',
      },
    },
  ],
  notes: {
    nl: 'Stripe en Mollie zijn beide goed ondersteund; iDEAL-tarief van Mollie is doorgaans gunstiger.',
    fr: 'Stripe et Mollie sont tous deux bien pris en charge ; les frais iDEAL de Mollie sont généralement plus favorables.',
    en: "Stripe and Mollie are both well supported; Mollie's iDEAL fees are typically more favourable.",
  },
};

export default nl;
