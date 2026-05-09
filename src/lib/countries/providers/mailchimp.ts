import type { ProviderEntry } from '../types';

const mailchimp: ProviderEntry = {
  id: 'mailchimp',
  name: 'Mailchimp',
  category: 'newsletter',
  authMethod: 'oauth',
  description: {
    nl: 'Toonaangevende internationale e-mailmarketing-tool met sterke template-bibliotheek.',
    fr: "Outil d'e-mail marketing international de référence avec une riche bibliothèque de templates.",
    en: 'Leading international email marketing tool with a strong template library.',
  },
  websiteUrl: 'https://mailchimp.com',
  documentationUrl: 'https://mailchimp.com/developer/',
  logoSlug: 'mailchimp',
  pricing: {
    free: true,
    notes: {
      nl: 'Gratis tot 500 contacten / 1.000 e-mails per maand; betaalde plannen vanaf ~$13/mnd.',
      fr: "Gratuit jusqu'à 500 contacts / 1 000 e-mails par mois ; formules payantes dès ~13 $/mois.",
      en: 'Free up to 500 contacts / 1,000 emails per month; paid plans from ~$13/mo.',
    },
  },
  setupComplexity: 'easy',
  recommendedFor: ['NL', 'CW'],
  availableIn: ['NL', 'CW'],
  features: ['email_campaigns', 'audiences', 'automation', 'landing_pages', 'reports'],
  caveats: {
    nl: 'Servers in de VS; voor strikte GDPR-cases kies Brevo (EU-hosting).',
    fr: 'Serveurs aux États-Unis ; pour des cas RGPD stricts, préférez Brevo (hébergement UE).',
    en: 'Servers in the US; for strict GDPR cases prefer Brevo (EU hosting).',
  },
};

export default mailchimp;
