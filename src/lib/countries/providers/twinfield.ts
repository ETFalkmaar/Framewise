import type { ProviderEntry } from '../types';

const twinfield: ProviderEntry = {
  id: 'twinfield',
  name: 'Twinfield (Wolters Kluwer)',
  category: 'accounting',
  authMethod: 'api_key',
  description: {
    nl: 'Enterprise-boekhouding van Wolters Kluwer, populair bij accountantskantoren.',
    fr: 'Comptabilité entreprise de Wolters Kluwer, populaire dans les cabinets comptables.',
    en: 'Enterprise accounting from Wolters Kluwer, popular with accounting firms.',
  },
  websiteUrl: 'https://www.wolterskluwer.com/en/solutions/twinfield',
  documentationUrl: 'https://accounting.twinfield.com/webservices/documentation',
  logoSlug: 'twinfield',
  pricing: {
    notes: {
      nl: 'Enterprise pricing op aanvraag, vaak via accountantskantoren.',
      fr: 'Tarification entreprise sur demande, souvent via cabinets comptables.',
      en: 'Enterprise pricing on request, typically via accounting firms.',
    },
  },
  setupComplexity: 'advanced',
  recommendedFor: ['NL'],
  availableIn: ['NL'],
  features: [
    'invoicing',
    'expenses',
    'tax_export',
    'banking_sync',
    'multi_currency',
    'multi_company',
  ],
  caveats: {
    nl: 'Doorgaans ingericht via een accountantskantoor; niet ideaal voor self-service onboarding.',
    fr: 'Généralement configuré via un cabinet comptable ; pas idéal pour un onboarding self-service.',
    en: 'Usually set up through an accounting firm; not ideal for self-service onboarding.',
  },
};

export default twinfield;
