import type { ProviderEntry } from '../types';

const bdoOnline: ProviderEntry = {
  id: 'bdo-online',
  name: 'BDO Online (Curaçao)',
  category: 'accounting',
  authMethod: 'api_key',
  description: {
    nl: 'Lokale boekhoud- en accountancydienstverlening op Curaçao via BDO.',
    fr: 'Services comptables locaux à Curaçao via BDO.',
    en: 'Local accounting and bookkeeping services on Curaçao via BDO.',
  },
  websiteUrl: 'https://www.bdo.cw',
  logoSlug: 'bdo-online',
  pricing: {
    notes: {
      nl: 'Op aanvraag; integraties zijn placeholder totdat een formele API beschikbaar komt.',
      fr: 'Sur demande ; intégration provisoire en attendant une API officielle.',
      en: 'On request; integration is a placeholder until a formal API is available.',
    },
  },
  setupComplexity: 'advanced',
  recommendedFor: ['CW'],
  availableIn: ['CW'],
  features: ['invoicing', 'expenses', 'local_compliance'],
  caveats: {
    nl: 'Geen publieke API gedocumenteerd op het moment van schrijven; in de praktijk vaak per export/CSV.',
    fr: "Pas d'API publique documentée actuellement ; souvent géré via exports CSV.",
    en: 'No public API documented at time of writing; typically handled via CSV exports.',
  },
};

export default bdoOnline;
