import type { ProviderEntry } from '../types';

const moneybird: ProviderEntry = {
  id: 'moneybird',
  name: 'Moneybird',
  category: 'accounting',
  authMethod: 'api_key',
  description: {
    nl: 'Lichtgewicht boekhoudpakket voor zzp en MKB in Nederland.',
    fr: 'Logiciel de comptabilité léger pour indépendants et PME aux Pays-Bas.',
    en: 'Lightweight accounting tool for freelancers and SMEs in the Netherlands.',
  },
  websiteUrl: 'https://www.moneybird.nl',
  documentationUrl: 'https://developer.moneybird.com',
  logoSlug: 'moneybird',
  pricing: {
    startingPriceMonthlyEur: 12,
    notes: {
      nl: 'Gratis startersplan tot 10 facturen per jaar; betaalde plannen vanaf circa €12/mnd.',
      fr: "Plan gratuit jusqu'à 10 factures par an ; plans payants à partir d'environ 12 €/mois.",
      en: 'Free starter plan up to 10 invoices per year; paid plans from about €12/mo.',
    },
  },
  setupComplexity: 'easy',
  recommendedFor: ['NL'],
  availableIn: ['NL'],
  features: ['invoicing', 'expenses', 'tax_export', 'banking_sync'],
};

export default moneybird;
