import type { ProviderEntry } from '../types';

const mollie: ProviderEntry = {
  id: 'mollie',
  name: 'Mollie',
  category: 'payments',
  authMethod: 'api_key',
  description: {
    nl: 'Nederlandse betalings­provider met focus op iDEAL en Europese methoden.',
    fr: 'Fournisseur de paiement néerlandais axé sur iDEAL et les méthodes européennes.',
    en: 'Dutch payments provider with strong iDEAL and European method coverage.',
  },
  websiteUrl: 'https://www.mollie.com',
  documentationUrl: 'https://docs.mollie.com',
  logoSlug: 'mollie',
  pricing: {
    transactionFeePercent: 1.8,
    notes: {
      nl: 'iDEAL €0,29; cards 1,8%–2,9% afhankelijk van type.',
      fr: 'iDEAL 0,29 € ; cartes 1,8 %–2,9 % selon le type.',
      en: 'iDEAL €0.29; cards 1.8%–2.9% depending on type.',
    },
  },
  setupComplexity: 'easy',
  recommendedFor: ['NL'],
  availableIn: ['NL'],
  features: ['cards', 'ideal', 'sepa', 'bancontact', 'apple_pay'],
};

export default mollie;
