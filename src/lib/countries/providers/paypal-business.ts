import type { ProviderEntry } from '../types';

const paypalBusiness: ProviderEntry = {
  id: 'paypal-business',
  name: 'PayPal Business',
  category: 'payments',
  authMethod: 'oauth',
  description: {
    nl: 'Wereldwijde betaal­methode, vaak gebruikt op Curaçao als alternatief voor Stripe.',
    fr: 'Moyen de paiement mondial, souvent utilisé à Curaçao comme alternative à Stripe.',
    en: 'Global payment method, frequently used on Curaçao as a Stripe alternative.',
  },
  websiteUrl: 'https://www.paypal.com/business',
  documentationUrl: 'https://developer.paypal.com',
  logoSlug: 'paypal-business',
  pricing: {
    transactionFeePercent: 2.9,
    notes: {
      nl: 'Standaard 2,9% + vaste fee per transactie; tarieven verschillen per regio.',
      fr: 'Standard 2,9 % + frais fixes par transaction ; les tarifs varient selon les régions.',
      en: 'Standard 2.9% + fixed fee per transaction; rates vary by region.',
    },
  },
  setupComplexity: 'easy',
  recommendedFor: ['CW'],
  availableIn: ['NL', 'CW'],
  features: ['cards', 'paypal_balance', 'recurring'],
};

export default paypalBusiness;
