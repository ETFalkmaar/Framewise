import { describe, expect, it } from 'vitest';
import { allTemplates, getTemplateById, getTemplatesForCountryAndPlan } from '@/lib/checklist';

describe('checklist templates', () => {
  it('every template id is unique', () => {
    const ids = allTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has a known country', () => {
    for (const t of allTemplates) {
      expect(['NL', 'CW']).toContain(t.country);
    }
  });

  it('every template has at least one applicable plan', () => {
    for (const t of allTemplates) {
      expect(t.planCodes.length).toBeGreaterThan(0);
      for (const code of t.planCodes) {
        expect(['basic', 'pro', 'enterprise']).toContain(code);
      }
    }
  });

  it('every template has labels + descriptions in nl/fr/en', () => {
    for (const t of allTemplates) {
      for (const locale of ['nl', 'fr', 'en'] as const) {
        expect(t.label[locale].length).toBeGreaterThan(0);
        expect(t.description[locale].length).toBeGreaterThan(0);
      }
    }
  });

  it('getTemplateById returns the template or undefined', () => {
    expect(getTemplateById('nl-domain')?.country).toBe('NL');
    expect(getTemplateById('cw-pro-kyc')?.required).toBe(false);
    expect(getTemplateById('not-a-template')).toBeUndefined();
  });

  it('NL Basic gets fewer templates than NL Pro, which gets fewer than NL Enterprise', () => {
    const basic = getTemplatesForCountryAndPlan('NL', 'basic').length;
    const pro = getTemplatesForCountryAndPlan('NL', 'pro').length;
    const enterprise = getTemplatesForCountryAndPlan('NL', 'enterprise').length;
    expect(basic).toBeLessThan(pro);
    expect(pro).toBeLessThanOrEqual(enterprise);
  });

  it('CW Enterprise contains the Stripe Atlas + KYC templates', () => {
    const ids = getTemplatesForCountryAndPlan('CW', 'enterprise').map((t) => t.id);
    expect(ids).toContain('cw-pro-stripe-atlas');
    expect(ids).toContain('cw-pro-kyc');
  });

  it('NL Enterprise does NOT contain Stripe Atlas / KYC (CW-specific)', () => {
    const ids = getTemplatesForCountryAndPlan('NL', 'enterprise').map((t) => t.id);
    expect(ids).not.toContain('cw-pro-stripe-atlas');
    expect(ids).not.toContain('cw-pro-kyc');
  });

  it('getTemplatesForCountryAndPlan returns items sorted by orderIndex', () => {
    const items = getTemplatesForCountryAndPlan('CW', 'enterprise');
    for (let i = 1; i < items.length; i++) {
      expect(items[i]!.orderIndex).toBeGreaterThanOrEqual(items[i - 1]!.orderIndex);
    }
  });

  it('required items have a lower orderIndex bucket than optional ones (per country)', () => {
    for (const country of ['NL', 'CW'] as const) {
      const items = getTemplatesForCountryAndPlan(country, 'enterprise');
      const maxRequired = Math.max(...items.filter((t) => t.required).map((t) => t.orderIndex));
      const minOptional = Math.min(...items.filter((t) => !t.required).map((t) => t.orderIndex));
      expect(maxRequired).toBeLessThan(minOptional);
    }
  });

  it('autoCompleteSource shapes are well-formed', () => {
    for (const t of allTemplates) {
      const src = t.autoCompleteSource;
      if (src.type === 'connection') {
        expect(['accounting', 'payments', 'phone', 'crm', 'newsletter']).toContain(src.category);
      } else if (src.type === 'tenant_field') {
        expect(['custom_domain', 'vat_number', 'crib_number']).toContain(src.field);
      } else {
        expect(src.type).toBe('manual');
      }
    }
  });
});
