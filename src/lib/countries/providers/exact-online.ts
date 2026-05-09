import type { ProviderEntry } from '../types';

const exactOnline: ProviderEntry = {
  id: 'exact-online',
  name: 'Exact Online',
  category: 'accounting',
  authMethod: 'oauth',
  description: {
    nl: 'Boekhoudpakket voor middelgrote en grotere bedrijven, met internationale ondersteuning.',
    fr: 'Logiciel de comptabilité pour PME et grandes entreprises, avec couverture internationale.',
    en: 'Accounting software for medium and large businesses with international coverage.',
  },
  websiteUrl: 'https://www.exact.com',
  documentationUrl: 'https://developers.exactonline.com',
  logoSlug: 'exact-online',
  pricing: {
    startingPriceMonthlyEur: 60,
    notes: {
      nl: 'Plannen vanaf circa €60/mnd; OAuth 2.0.',
      fr: "Plans à partir d'environ 60 €/mois ; OAuth 2.0.",
      en: 'Plans from about €60/mo; OAuth 2.0.',
    },
  },
  setupComplexity: 'advanced',
  recommendedFor: ['NL'],
  availableIn: ['NL'],
  features: ['invoicing', 'expenses', 'tax_export', 'banking_sync', 'multi_currency'],
};

export default exactOnline;
