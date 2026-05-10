export {
  ACCEPT_ALL,
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  CONSENT_TTL_DAYS,
  CONSENT_VERSION,
  DEFAULT_DENY,
  type ConsentCategory,
  type ConsentChoices,
  type ConsentRecord,
} from './types';
export {
  clearConsent,
  getCurrentChoices,
  hasGivenConsent,
  readConsent,
  writeConsent,
} from './storage';
