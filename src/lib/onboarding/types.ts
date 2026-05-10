/**
 * Super-admin onboarding wizard types (step 30, fase 10).
 *
 * The wizard collects everything we need to spin up a brand-new
 * customer tenant in one go: company info, country, slug + plan,
 * tax/legal details. After submit, `createTenant()` produces a
 * tenant + owner user + country settings + checklist atomically
 * and returns the freshly minted credentials.
 */

import type { Country, LocaleCode, SubscriptionPlanCode } from '@/types/database';

export const ONBOARDING_STEPS = [
  'basic-info',
  'country',
  'tenant-details',
  'tax-info',
  'review',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingFormData {
  // Step 1: Basic info — company + primary contact
  companyName: string;
  contactEmail: string;
  contactName: string;
  preferredLocale: LocaleCode;

  // Step 2: Country gate (drives provider/currency/legal-id later)
  country: Country;

  // Step 3: Tenant routing details
  tenantSlug: string;
  customDomain: string | null;
  planTier: SubscriptionPlanCode;

  // Step 4: Tax + legal address (lands in `tenant_country_settings`)
  vatNumber?: string;
  cribNumber?: string;
  legalName: string;
  legalAddress: string;
  legalCity: string;
  legalPostalCode: string;
}

export interface OnboardingResult {
  success: boolean;
  tenantId?: string;
  ownerUserId?: string;
  contactEmail?: string;
  /**
   * Only present in the response — never stored on the server.
   * The wizard renders this once on the success card so the
   * super-admin can copy it; refreshing the page loses it.
   */
  initialPassword?: string;
  error?: string;
}
