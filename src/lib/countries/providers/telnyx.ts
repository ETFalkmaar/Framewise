import type { ProviderEntry } from '../types';

const telnyx: ProviderEntry = {
  id: 'telnyx',
  name: 'Telnyx',
  category: 'phone',
  authMethod: 'api_key',
  description: {
    nl: 'Telefonie-platform met betere wereldwijde dekking; één van de weinige met +599 (Curaçao) nummers.',
    fr: "Plateforme de téléphonie avec meilleure couverture mondiale ; l'une des rares offrant des numéros +599 (Curaçao).",
    en: 'Telephony platform with broader global coverage; one of the few that offers +599 (Curaçao) numbers.',
  },
  websiteUrl: 'https://telnyx.com',
  documentationUrl: 'https://developers.telnyx.com',
  logoSlug: 'telnyx',
  pricing: {
    startingPriceMonthlyEur: 2,
    notes: {
      nl: 'Curaçao nummers ca. $2/mnd; gebruik per minuut. KYC-documenten vereist.',
      fr: 'Numéros Curaçao env. 2 $/mois ; usage par minute. Documents KYC requis.',
      en: '+599 numbers from ~$2/mo; usage billed per minute. KYC documents required.',
    },
  },
  setupComplexity: 'medium',
  recommendedFor: ['CW'],
  availableIn: ['CW'],
  features: ['voice', 'sms', 'caribbean_dids'],
  caveats: {
    nl: 'KYC-traject is doorgaans 1–3 werkdagen; bedrijfsdocumenten vereist voor +599 nummers.',
    fr: "Le KYC prend généralement 1 à 3 jours ouvrés ; documents d'entreprise requis pour les numéros +599.",
    en: 'KYC review usually takes 1–3 business days; company documents required for +599 numbers.',
  },
};

export default telnyx;
