import type { ProviderEntry } from '../types';

const brevo: ProviderEntry = {
  id: 'brevo',
  name: 'Brevo',
  category: 'newsletter',
  authMethod: 'api_key',
  description: {
    nl: 'EU-gehoste e-mailmarketing (voorheen Sendinblue) met sterke gratis tier en GDPR-focus.',
    fr: "Plateforme d'e-mail marketing européenne (ex-Sendinblue) avec formule gratuite solide et conformité RGPD.",
    en: 'EU-hosted email marketing (formerly Sendinblue) with a generous free tier and GDPR focus.',
  },
  websiteUrl: 'https://www.brevo.com',
  documentationUrl: 'https://developers.brevo.com',
  logoSlug: 'brevo',
  pricing: {
    free: true,
    notes: {
      nl: 'Gratis tot 300 e-mails/dag; betaalde plannen vanaf ~€7/mnd voor hogere volumes.',
      fr: "Gratuit jusqu'à 300 e-mails/jour ; formules payantes à partir d'environ 7 €/mois.",
      en: 'Free up to 300 emails/day; paid plans from ~€7/mo for higher volumes.',
    },
  },
  setupComplexity: 'easy',
  recommendedFor: ['NL', 'CW'],
  availableIn: ['NL', 'CW'],
  features: ['email_campaigns', 'transactional', 'contacts', 'automation', 'gdpr_eu_hosting'],
};

export default brevo;
