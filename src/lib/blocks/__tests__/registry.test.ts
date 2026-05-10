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
  it('contains exactly the 4 block types step 24 ships', () => {
    expect(KNOWN_BLOCK_TYPES).toEqual(['hero', 'text', 'image', 'cta']);
  });

  it('has 4 unique entries', () => {
    expect(new Set(KNOWN_BLOCK_TYPES).size).toBe(4);
  });
});

describe('isKnownBlockType', () => {
  it('returns true for all 4 known types', () => {
    for (const t of KNOWN_BLOCK_TYPES) {
      expect(isKnownBlockType(t)).toBe(true);
    }
  });

  it('returns false for unknown types (step 25 placeholders)', () => {
    expect(isKnownBlockType('gallery')).toBe(false);
    expect(isKnownBlockType('faq')).toBe(false);
    expect(isKnownBlockType('pricing')).toBe(false);
    expect(isKnownBlockType('contact')).toBe(false);
  });

  it('returns false for nonsense input', () => {
    expect(isKnownBlockType('totally-made-up')).toBe(false);
    expect(isKnownBlockType('')).toBe(false);
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

  it('returns null for unknown types', () => {
    expect(getBlockComponent('gallery')).toBeNull();
    expect(getBlockComponent('totally-made-up')).toBeNull();
    expect(getBlockComponent('')).toBeNull();
  });
});

describe('renderBlock', () => {
  const heroBlock: ContentBlock = {
    id: 'b1',
    position: 0,
    type: 'hero',
    props: {
      headline_translations: { nl: 'Hallo', en: 'Hello' },
    },
  };

  it('returns a React element for a known block type', () => {
    const node = renderBlock(heroBlock, 'en', 'nl');
    expect(node).not.toBeNull();
    expect(isValidElement(node)).toBe(true);
  });

  it('returns null for an unknown block type (defensive)', () => {
    const fake = { ...heroBlock, type: 'unknown' } as unknown as ContentBlock;
    expect(renderBlock(fake, 'en', 'nl')).toBeNull();
  });
});
