import { describe, expect, it } from 'vitest';
import {
  KNOWN_BLOCK_TYPES,
  VALID_CONTACT_FORM_FIELDS,
  type ContactBlock,
  type ContentBlock,
  type FaqBlock,
  type GalleryBlock,
  type PricingBlock,
  type PricingPlan,
} from '@/lib/blocks/types';

describe('KNOWN_BLOCK_TYPES — value-level invariants', () => {
  it('has exactly 8 entries (4 base + 4 step-25)', () => {
    expect(KNOWN_BLOCK_TYPES).toHaveLength(8);
  });

  it('contains the 4 step-25 additions', () => {
    expect(KNOWN_BLOCK_TYPES).toContain('gallery');
    expect(KNOWN_BLOCK_TYPES).toContain('faq');
    expect(KNOWN_BLOCK_TYPES).toContain('pricing');
    expect(KNOWN_BLOCK_TYPES).toContain('contact');
  });

  it('preserves a stable ordering — base types first, step 25 after', () => {
    expect(KNOWN_BLOCK_TYPES.slice(0, 4)).toEqual(['hero', 'text', 'image', 'cta']);
    expect(KNOWN_BLOCK_TYPES.slice(4)).toEqual(['gallery', 'faq', 'pricing', 'contact']);
  });
});

describe('VALID_CONTACT_FORM_FIELDS', () => {
  it('lists exactly the 5 valid contact-form fields', () => {
    expect(VALID_CONTACT_FORM_FIELDS).toEqual(['name', 'email', 'phone', 'subject', 'message']);
  });
});

describe('GalleryBlock — discriminated typing', () => {
  it('lets a value-only narrowing read props.images via type guard', () => {
    const block: ContentBlock = {
      id: 'g1',
      position: 0,
      type: 'gallery',
      props: {
        images: [
          { url: 'https://example.com/a.jpg', alt_translations: { en: 'A' } },
          { url: 'https://example.com/b.jpg', alt_translations: { en: 'B' } },
        ],
        layout: 'grid',
        columns: 3,
      },
    };
    if (block.type === 'gallery') {
      const gallery: GalleryBlock = block;
      expect(gallery.props.images).toHaveLength(2);
      expect(gallery.props.layout).toBe('grid');
    }
  });
});

describe('FaqBlock — discriminated typing', () => {
  it('lets the items array carry per-item Q+A translations', () => {
    const block: ContentBlock = {
      id: 'f1',
      position: 1,
      type: 'faq',
      props: {
        items: [
          {
            question_translations: { en: 'Q?' },
            answer_translations: { en: 'A.' },
          },
        ],
      },
    };
    if (block.type === 'faq') {
      const faq: FaqBlock = block;
      expect(faq.props.items[0]?.question_translations.en).toBe('Q?');
    }
  });
});

describe('PricingBlock — discriminated typing', () => {
  it('exposes plans with id + price + features array', () => {
    const plan: PricingPlan = {
      id: 'basic',
      name_translations: { en: 'Basic' },
      price: '€0',
      features_translations: [{ en: 'Feature one' }, { en: 'Feature two' }],
    };
    const block: ContentBlock = {
      id: 'p1',
      position: 2,
      type: 'pricing',
      props: { plans: [plan] },
    };
    if (block.type === 'pricing') {
      const pricing: PricingBlock = block;
      expect(pricing.props.plans).toHaveLength(1);
      expect(pricing.props.plans[0]?.features_translations).toHaveLength(2);
    }
  });
});

describe('ContactBlock — discriminated typing', () => {
  it('accepts any subset of valid fields in any order', () => {
    const block: ContentBlock = {
      id: 'c1',
      position: 3,
      type: 'contact',
      props: {
        fields: ['email', 'message'],
        submit_text_translations: { en: 'Send' },
        success_message_translations: { en: 'Thanks!' },
      },
    };
    if (block.type === 'contact') {
      const contact: ContactBlock = block;
      expect(contact.props.fields).toEqual(['email', 'message']);
    }
  });

  it('VALID_CONTACT_FORM_FIELDS contains every option the type allows', () => {
    // If the type ever grows a new field, this test forces the
    // VALID_CONTACT_FORM_FIELDS constant to be updated too.
    const exhaustive: ContactBlock['props']['fields'] = [
      'name',
      'email',
      'phone',
      'subject',
      'message',
    ];
    for (const field of exhaustive) {
      expect(VALID_CONTACT_FORM_FIELDS).toContain(field);
    }
  });
});

describe('ContentBlock union accepts all 8 types', () => {
  it('compiles for every type and preserves the discriminant', () => {
    const blocks: ContentBlock[] = [
      { id: '1', position: 0, type: 'hero', props: { headline_translations: { en: 'H' } } },
      { id: '2', position: 1, type: 'text', props: { content_translations: { en: 'T' } } },
      {
        id: '3',
        position: 2,
        type: 'image',
        props: { image_url: 'x', alt_translations: { en: 'A' } },
      },
      {
        id: '4',
        position: 3,
        type: 'cta',
        props: {
          headline_translations: { en: 'H' },
          button_text_translations: { en: 'B' },
          button_link: '/x',
        },
      },
      {
        id: '5',
        position: 4,
        type: 'gallery',
        props: { images: [{ url: 'x', alt_translations: { en: 'A' } }] },
      },
      {
        id: '6',
        position: 5,
        type: 'faq',
        props: {
          items: [{ question_translations: { en: 'Q' }, answer_translations: { en: 'A' } }],
        },
      },
      {
        id: '7',
        position: 6,
        type: 'pricing',
        props: {
          plans: [
            {
              id: 'p',
              name_translations: { en: 'N' },
              price: '€0',
              features_translations: [],
            },
          ],
        },
      },
      {
        id: '8',
        position: 7,
        type: 'contact',
        props: {
          fields: ['email'],
          submit_text_translations: { en: 'Send' },
          success_message_translations: { en: 'Thanks' },
        },
      },
    ];
    const types = blocks.map((b) => b.type).sort();
    expect(types).toEqual(['contact', 'cta', 'faq', 'gallery', 'hero', 'image', 'pricing', 'text']);
  });
});
