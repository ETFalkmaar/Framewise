import type { ProviderEntry } from '../types';

const hubspot: ProviderEntry = {
  id: 'hubspot',
  name: 'HubSpot CRM',
  category: 'crm',
  authMethod: 'oauth',
  description: {
    nl: 'Wereldwijd CRM-platform met sterke gratis tier en uitgebreide marketing-tools.',
    fr: 'Plateforme CRM mondiale avec une formule gratuite solide et des outils marketing étendus.',
    en: 'Global CRM platform with a strong free tier and extensive marketing tools.',
  },
  websiteUrl: 'https://www.hubspot.com',
  documentationUrl: 'https://developers.hubspot.com',
  logoSlug: 'hubspot',
  pricing: {
    free: true,
    notes: {
      nl: 'Gratis CRM voor onbeperkt aantal gebruikers; betaalde plannen vanaf ~€20/mnd voor extra features.',
      fr: "CRM gratuit pour un nombre illimité d'utilisateurs ; formules payantes à partir d'environ 20 €/mois.",
      en: 'Free CRM for unlimited users; paid plans from ~€20/mo for advanced features.',
    },
  },
  setupComplexity: 'easy',
  recommendedFor: ['NL', 'CW'],
  availableIn: ['NL', 'CW'],
  features: ['contacts', 'deals', 'pipelines', 'email_tracking', 'forms', 'workflows'],
};

export default hubspot;
