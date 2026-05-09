import type { ProviderEntry } from '../types';

const stripe: ProviderEntry = {
  id: 'stripe',
  name: 'Stripe',
  category: 'payments',
  authMethod: 'oauth',
  description: {
    nl: 'Wereldwijde betalings­provider met sterke ontwikkelaars-API en uitgebreide methoden.',
    fr: 'Fournisseur de paiement mondial avec une API développeur solide et des méthodes étendues.',
    en: 'Global payments provider with a strong developer API and broad payment methods.',
  },
  websiteUrl: 'https://stripe.com',
  documentationUrl: 'https://stripe.com/docs',
  logoSlug: 'stripe',
  pricing: {
    transactionFeePercent: 1.4,
    notes: {
      nl: 'EU-kaarten 1,4% + €0,25; non-EU 2,9% + €0,25; iDEAL €0,29 vast.',
      fr: 'Cartes UE 1,4 % + 0,25 € ; hors UE 2,9 % + 0,25 € ; iDEAL 0,29 € fixe.',
      en: 'EU cards 1.4% + €0.25; non-EU 2.9% + €0.25; iDEAL €0.29 flat.',
    },
  },
  setupComplexity: 'medium',
  recommendedFor: ['NL'],
  availableIn: ['NL', 'CW'],
  features: ['cards', 'ideal', 'sepa', 'apple_pay', 'google_pay', 'connect_oauth'],
  caveats: {
    nl: 'Niet officieel beschikbaar voor in Curaçao gevestigde bedrijven; vereist Stripe Atlas (US-route) of een EU-entiteit.',
    fr: 'Pas officiellement disponible pour les entreprises basées à Curaçao ; nécessite Stripe Atlas (route US) ou une entité UE.',
    en: 'Not officially available for businesses based in Curaçao; requires Stripe Atlas (US route) or an EU entity.',
  },
};

export default stripe;
