import type { ProviderEntry } from '../types';

const pipedrive: ProviderEntry = {
  id: 'pipedrive',
  name: 'Pipedrive',
  category: 'crm',
  authMethod: 'oauth',
  description: {
    nl: 'Sales-gericht CRM met visuele pijplijn en duidelijke deal-tracking.',
    fr: 'CRM orienté ventes avec pipeline visuel et suivi clair des opportunités.',
    en: 'Sales-focused CRM with a visual pipeline and clear deal tracking.',
  },
  websiteUrl: 'https://www.pipedrive.com',
  documentationUrl: 'https://developers.pipedrive.com',
  logoSlug: 'pipedrive',
  pricing: {
    startingPriceMonthlyEur: 15,
    notes: {
      nl: 'Vanaf ~€15/gebruiker/mnd (Essential); geen gratis tier maar 14 dagen proefperiode.',
      fr: "À partir d'environ 15 €/utilisateur/mois (Essential) ; pas de formule gratuite, essai de 14 jours.",
      en: 'From ~€15/user/mo (Essential); no free tier, 14-day trial.',
    },
  },
  setupComplexity: 'easy',
  recommendedFor: ['NL', 'CW'],
  availableIn: ['NL', 'CW'],
  features: ['contacts', 'deals', 'pipelines', 'activities', 'reports'],
};

export default pipedrive;
