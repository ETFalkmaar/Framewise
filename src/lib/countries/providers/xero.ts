import type { ProviderEntry } from '../types';

const xero: ProviderEntry = {
  id: 'xero',
  name: 'Xero',
  category: 'accounting',
  authMethod: 'oauth',
  description: {
    nl: 'Internationaal boekhoudpakket, populair in het Caribisch gebied en de VS.',
    fr: 'Logiciel de comptabilité international, populaire dans la Caraïbe et aux États-Unis.',
    en: 'International accounting platform, popular in the Caribbean and the US.',
  },
  websiteUrl: 'https://www.xero.com',
  documentationUrl: 'https://developer.xero.com',
  logoSlug: 'xero',
  pricing: {
    startingPriceMonthlyEur: 14,
    notes: {
      nl: 'Plannen vanaf circa $15/mnd; OAuth 2.0.',
      fr: "Plans à partir d'environ 15 $/mois ; OAuth 2.0.",
      en: 'Plans from about $15/mo; OAuth 2.0.',
    },
  },
  setupComplexity: 'medium',
  recommendedFor: ['CW'],
  availableIn: ['CW'],
  features: ['invoicing', 'expenses', 'multi_currency', 'banking_sync'],
};

export default xero;
