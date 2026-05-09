import type { ProviderEntry } from '../types';

const twilio: ProviderEntry = {
  id: 'twilio',
  name: 'Twilio',
  category: 'phone',
  authMethod: 'api_key',
  description: {
    nl: 'Telefonie- en SMS-platform; nodig voor inbound nummers van de AI-agent.',
    fr: "Plateforme de téléphonie et SMS ; nécessaire pour les numéros entrants de l'agent IA.",
    en: 'Telephony and SMS platform; needed for inbound numbers used by the AI agent.',
  },
  websiteUrl: 'https://www.twilio.com',
  documentationUrl: 'https://www.twilio.com/docs',
  logoSlug: 'twilio',
  pricing: {
    startingPriceMonthlyEur: 1,
    notes: {
      nl: 'NL-mobielnummer ca. $1/mnd, geografisch nummer ca. $1–15/mnd; gebruik per minuut/SMS.',
      fr: 'Numéro mobile NL env. 1 $/mois, numéro géographique 1–15 $/mois ; usage par minute/SMS.',
      en: 'NL mobile number from ~$1/mo, geographic number $1–15/mo; usage billed per minute/SMS.',
    },
  },
  setupComplexity: 'medium',
  recommendedFor: ['NL'],
  availableIn: ['NL'],
  features: ['voice', 'sms', 'whatsapp', 'verify_otp'],
};

export default twilio;
