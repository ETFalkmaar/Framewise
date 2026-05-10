import { describe, expect, it } from 'vitest';

import {
  basicInfoSchema,
  countryStepSchema,
  onboardingSchema,
  taxInfoSchema,
  tenantDetailsSchema,
} from '../validation';

const VALID_BASIC = {
  companyName: 'Villa Curaçao',
  contactEmail: 'OWNER@example.com',
  contactName: 'Anna de Vries',
  preferredLocale: 'nl' as const,
};

const VALID_TENANT = {
  tenantSlug: 'villa-curacao',
  customDomain: null,
  planTier: 'pro' as const,
};

const VALID_TAX_NL = {
  country: 'NL' as const,
  vatNumber: 'NL123456789B01',
  cribNumber: '',
  legalName: 'Villa Curaçao B.V.',
  legalAddress: 'Damrak 12',
  legalCity: 'Amsterdam',
  legalPostalCode: '1012LP',
};

const VALID_TAX_CW = {
  country: 'CW' as const,
  vatNumber: '',
  cribNumber: '0123456789',
  legalName: 'Villa Curaçao N.V.',
  legalAddress: 'Caracasbaaiweg 1',
  legalCity: 'Willemstad',
  legalPostalCode: '0000',
};

const FULL_INPUT = {
  ...VALID_BASIC,
  ...VALID_TENANT,
  country: 'NL' as const,
  vatNumber: 'NL123456789B01',
  cribNumber: '',
  legalName: VALID_TAX_NL.legalName,
  legalAddress: VALID_TAX_NL.legalAddress,
  legalCity: VALID_TAX_NL.legalCity,
  legalPostalCode: VALID_TAX_NL.legalPostalCode,
};

describe('basicInfoSchema', () => {
  it('accepts a clean payload', () => {
    expect(basicInfoSchema.safeParse(VALID_BASIC).success).toBe(true);
  });

  it('lowercases the email', () => {
    const parsed = basicInfoSchema.parse(VALID_BASIC);
    expect(parsed.contactEmail).toBe('owner@example.com');
  });

  it('rejects an invalid email', () => {
    expect(
      basicInfoSchema.safeParse({ ...VALID_BASIC, contactEmail: 'not-an-email' }).success
    ).toBe(false);
  });

  it('rejects too short a company name', () => {
    expect(basicInfoSchema.safeParse({ ...VALID_BASIC, companyName: 'A' }).success).toBe(false);
  });

  it('rejects unsupported locale', () => {
    expect(basicInfoSchema.safeParse({ ...VALID_BASIC, preferredLocale: 'de' }).success).toBe(
      false
    );
  });
});

describe('countryStepSchema', () => {
  it('accepts NL', () => {
    expect(countryStepSchema.safeParse({ country: 'NL' }).success).toBe(true);
  });

  it('accepts CW', () => {
    expect(countryStepSchema.safeParse({ country: 'CW' }).success).toBe(true);
  });

  it('rejects unsupported country', () => {
    expect(countryStepSchema.safeParse({ country: 'BE' }).success).toBe(false);
  });
});

describe('tenantDetailsSchema', () => {
  it('accepts a slug, no custom domain, and a plan', () => {
    expect(tenantDetailsSchema.safeParse(VALID_TENANT).success).toBe(true);
  });

  it('accepts a custom domain when set', () => {
    const result = tenantDetailsSchema.safeParse({
      ...VALID_TENANT,
      customDomain: 'klant.nl',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid slug (uppercase / spaces)', () => {
    expect(tenantDetailsSchema.safeParse({ ...VALID_TENANT, tenantSlug: 'Bad Slug' }).success).toBe(
      false
    );
  });

  it('rejects a malformed custom domain', () => {
    expect(
      tenantDetailsSchema.safeParse({ ...VALID_TENANT, customDomain: 'not a domain' }).success
    ).toBe(false);
  });

  it('rejects an unsupported plan tier', () => {
    expect(tenantDetailsSchema.safeParse({ ...VALID_TENANT, planTier: 'unlimited' }).success).toBe(
      false
    );
  });
});

describe('taxInfoSchema', () => {
  it('accepts a valid NL payload with VAT number', () => {
    expect(taxInfoSchema.safeParse(VALID_TAX_NL).success).toBe(true);
  });

  it('accepts a valid CW payload with CRIB number', () => {
    expect(taxInfoSchema.safeParse(VALID_TAX_CW).success).toBe(true);
  });

  it('rejects NL without a VAT number', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_TAX_NL,
      vatNumber: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects NL with malformed VAT number', () => {
    expect(taxInfoSchema.safeParse({ ...VALID_TAX_NL, vatNumber: '123456789' }).success).toBe(
      false
    );
  });

  it('rejects CW without a CRIB number', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_TAX_CW,
      cribNumber: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects too short a legal address', () => {
    expect(taxInfoSchema.safeParse({ ...VALID_TAX_NL, legalAddress: 'No.' }).success).toBe(false);
  });
});

describe('onboardingSchema', () => {
  it('accepts a fully valid payload (NL)', () => {
    expect(onboardingSchema.safeParse(FULL_INPUT).success).toBe(true);
  });

  it('accepts a fully valid payload (CW)', () => {
    const cwInput = {
      ...FULL_INPUT,
      country: 'CW' as const,
      vatNumber: '',
      cribNumber: '0123456789',
      legalAddress: 'Caracasbaaiweg 1',
      legalCity: 'Willemstad',
      legalPostalCode: '0000',
    };
    expect(onboardingSchema.safeParse(cwInput).success).toBe(true);
  });

  it('cross-validates country vs tax id (NL needs VAT)', () => {
    const result = onboardingSchema.safeParse({
      ...FULL_INPUT,
      vatNumber: '',
    });
    expect(result.success).toBe(false);
  });

  it('cross-validates country vs tax id (CW needs CRIB)', () => {
    const result = onboardingSchema.safeParse({
      ...FULL_INPUT,
      country: 'CW',
      vatNumber: '',
      cribNumber: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when slug is invalid', () => {
    expect(onboardingSchema.safeParse({ ...FULL_INPUT, tenantSlug: 'BadSlug' }).success).toBe(
      false
    );
  });
});
