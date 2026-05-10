import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import {
  KNOWN_BLOCK_TYPES,
  getBlockComponent,
  isKnownBlockType,
  renderBlock,
} from '@/lib/blocks/registry';
import type { ContentBlock } from '@/lib/blocks/types';

describe('KNOWN_BLOCK_TYPES', () => {
  it('contains exactly the 8 block types after step 25', () => {
    expect(KNOWN_BLOCK_TYPES).toEqual([
      'hero',
      'text',
      'image',
      'cta',
      'gallery',
      'faq',
      'pricing',
      'contact',
    ]);
  });

  it('has 8 unique entries', () => {
    expect(new Set(KNOWN_BLOCK_TYPES).size).toBe(8);
  });
});

describe('isKnownBlockType', () => {
  it('returns true for all 8 known types', () => {
    for (const t of KNOWN_BLOCK_TYPES) {
      expect(isKnownBlockType(t)).toBe(true);
    }
  });

  it('returns true for the 4 step-25 additions specifically', () => {
    expect(isKnownBlockType('gallery')).toBe(true);
    expect(isKnownBlockType('faq')).toBe(true);
    expect(isKnownBlockType('pricing')).toBe(true);
    expect(isKnownBlockType('contact')).toBe(true);
  });

  it('returns false for nonsense input', () => {
    expect(isKnownBlockType('totally-made-up')).toBe(false);
    expect(isKnownBlockType('')).toBe(false);
    expect(isKnownBlockType('HERO')).toBe(false);
  });
});

describe('getBlockComponent', () => {
  it('returns a component for every known type', () => {
    for (const t of KNOWN_BLOCK_TYPES) {
      const Component = getBlockComponent(t);
      expect(Component).not.toBeNull();
      expect(typeof Component).toBe('function');
    }
  });

  it('returns a component for each of the 4 step-25 additions', () => {
    expect(getBlockComponent('gallery')).not.toBeNull();
    expect(getBlockComponent('faq')).not.toBeNull();
    expect(getBlockComponent('pricing')).not.toBeNull();
    expect(getBlockComponent('contact')).not.toBeNull();
  });

  it('returns null for unknown types', () => {
    expect(getBlockComponent('totally-made-up')).toBeNull();
    expect(getBlockComponent('')).toBeNull();
  });
});

describe('renderBlock', () => {
  const sampleBlocks: Array<{ name: string; block: ContentBlock }> = [
    {
      name: 'hero',
      block: {
        id: 'b1',
        position: 0,
        type: 'hero',
        props: { headline_translations: { nl: 'Hallo', en: 'Hello' } },
      },
    },
    {
      name: 'text',
      block: {
        id: 'b2',
        position: 0,
        type: 'text',
        props: { content_translations: { nl: 'Inhoud', en: 'Content' } },
      },
    },
    {
      name: 'image',
      block: {
        id: 'b3',
        position: 0,
        type: 'image',
        props: {
          image_url: 'https://example.com/img.jpg',
          alt_translations: { nl: 'Afbeelding', en: 'Image' },
        },
      },
    },
    {
      name: 'cta',
      block: {
        id: 'b4',
        position: 0,
        type: 'cta',
        props: {
          headline_translations: { nl: 'Klik hier', en: 'Click here' },
          button_text_translations: { nl: 'Naar', en: 'Go' },
          button_link: '/x',
        },
      },
    },
    {
      name: 'gallery',
      block: {
        id: 'b5',
        position: 0,
        type: 'gallery',
        props: {
          images: [{ url: 'https://example.com/a.jpg', alt_translations: { nl: 'A', en: 'A' } }],
        },
      },
    },
    {
      name: 'faq',
      block: {
        id: 'b6',
        position: 0,
        type: 'faq',
        props: {
          items: [
            {
              question_translations: { nl: 'V?', en: 'Q?' },
              answer_translations: { nl: 'A.', en: 'A.' },
            },
          ],
        },
      },
    },
    {
      name: 'pricing',
      block: {
        id: 'b7',
        position: 0,
        type: 'pricing',
        props: {
          plans: [
            {
              id: 'basic',
              name_translations: { nl: 'Basis', en: 'Basic' },
              price: '€0',
              features_translations: [{ nl: 'Functie', en: 'Feature' }],
            },
          ],
        },
      },
    },
    {
      name: 'contact',
      block: {
        id: 'b8',
        position: 0,
        type: 'contact',
        props: {
          fields: ['name', 'email'],
          submit_text_translations: { nl: 'Verstuur', en: 'Send' },
          success_message_translations: { nl: 'Bedankt!', en: 'Thanks!' },
        },
      },
    },
  ];

  for (const { name, block } of sampleBlocks) {
    it(`returns a React element for block type "${name}"`, () => {
      const node = renderBlock(block, 'en', 'nl');
      expect(node).not.toBeNull();
      expect(isValidElement(node)).toBe(true);
    });
  }

  it('returns null for an unknown block type (defensive)', () => {
    const fake = { ...sampleBlocks[0]!.block, type: 'unknown' } as unknown as ContentBlock;
    expect(renderBlock(fake, 'en', 'nl')).toBeNull();
  });
});
