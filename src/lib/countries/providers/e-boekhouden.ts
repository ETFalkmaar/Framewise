import type { ProviderEntry } from '../types';

const eBoekhouden: ProviderEntry = {
  id: 'e-boekhouden',
  name: 'e-Boekhouden.nl',
  category: 'accounting',
  authMethod: 'api_key',
  description: {
    nl: 'Online boekhoudpakket gericht op Nederlandse zzp en MKB.',
    fr: 'Logiciel de comptabilité en ligne pour indépendants et PME néerlandais.',
    en: 'Online accounting tool aimed at Dutch freelancers and SMEs.',
  },
  websiteUrl: 'https://www.e-boekhouden.nl',
  documentationUrl: 'https://www.e-boekhouden.nl/koppelingen/api',
  logoSlug: 'e-boekhouden',
  pricing: {
    startingPriceMonthlyEur: 10,
    notes: {
      nl: 'Plannen vanaf circa €10/mnd; SOAP API met tokens.',
      fr: "Plans à partir d'environ 10 €/mois ; API SOAP avec jetons.",
      en: 'Plans from about €10/mo; SOAP API with session tokens.',
    },
  },
  setupComplexity: 'easy',
  recommendedFor: ['NL'],
  availableIn: ['NL'],
  features: ['invoicing', 'expenses', 'tax_export'],
};

export default eBoekhouden;
