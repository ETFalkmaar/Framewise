import type { ProviderEntry } from '../types';

const quickbooks: ProviderEntry = {
  id: 'quickbooks',
  name: 'QuickBooks Online',
  category: 'accounting',
  authMethod: 'oauth',
  description: {
    nl: 'Boekhoudpakket van Intuit met sterke aanwezigheid in de VS en het Caribisch gebied.',
    fr: "Logiciel de comptabilité d'Intuit avec forte présence aux États-Unis et dans la Caraïbe.",
    en: 'Intuit accounting platform with a strong US and Caribbean presence.',
  },
  websiteUrl: 'https://quickbooks.intuit.com',
  documentationUrl: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
  logoSlug: 'quickbooks',
  pricing: {
    startingPriceMonthlyEur: 14,
    notes: {
      nl: 'Plannen vanaf circa $15/mnd.',
      fr: "Plans à partir d'environ 15 $/mois.",
      en: 'Plans from about $15/mo.',
    },
  },
  setupComplexity: 'medium',
  recommendedFor: ['CW'],
  availableIn: ['CW'],
  features: ['invoicing', 'expenses', 'multi_currency', 'banking_sync'],
};

export default quickbooks;
