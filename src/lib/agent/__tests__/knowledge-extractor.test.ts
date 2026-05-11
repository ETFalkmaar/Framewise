import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { blocksRepo, pagesRepo, resetStore } from '@/lib/data';
import {
  buildKnowledgeBaseSnapshot,
  extractFromPageBlocks,
  pageDocumentTitle,
  stripHtml,
} from '@/lib/agent/knowledge-extractor';
import type { Block, Page } from '@/types/database';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';

function block(
  block_type: Block['block_type'],
  data: Record<string, unknown>,
  order_index = 0
): Block {
  return {
    id: `b-${Math.random()}`,
    page_id: 'p-1',
    block_type,
    order_index,
    data,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1,
  };
}

describe('stripHtml (step 58)', () => {
  it('removes tags but keeps text', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('converts <br> to newlines', () => {
    expect(stripHtml('one<br>two<br/>three')).toBe('one\ntwo\nthree');
  });

  it('normalises horizontal whitespace', () => {
    expect(stripHtml('  spaced    out   text  ')).toBe('spaced out text');
  });

  it('decodes the common HTML entities', () => {
    expect(stripHtml('Tom &amp; Jerry &quot;duo&quot; &nbsp;say&nbsp;hi')).toBe(
      'Tom & Jerry "duo" say hi'
    );
  });

  it('collapses excessive blank lines', () => {
    expect(stripHtml('a</p><p>b</p><p>c</p>')).toBe('a\nb\nc');
  });
});

describe('extractFromPageBlocks (step 58)', () => {
  it('pulls the hero headline + subheadline (real seed shape)', () => {
    const blocks = [
      block('hero', {
        headline_translations: { nl: 'Ervaar Curaçao', en: 'Experience Curaçao' },
        subheadline_translations: { nl: 'Luxe villa', en: 'Luxury villa' },
        image_url: 'https://example.com/hero.jpg',
      }),
    ];
    const text = extractFromPageBlocks(blocks, 'nl');
    expect(text).toContain('Ervaar Curaçao');
    expect(text).toContain('Luxe villa');
    // No image-only data should leak in.
    expect(text).not.toContain('example.com');
  });

  it('falls back to en when primary locale is missing', () => {
    const blocks = [
      block('hero', {
        headline_translations: { en: 'Only English' },
      }),
    ];
    expect(extractFromPageBlocks(blocks, 'nl')).toContain('Only English');
  });

  it('strips HTML from text blocks', () => {
    const blocks = [
      block('text', {
        content_translations: {
          nl: '<p>Onze villa biedt <strong>4 slaapkamers</strong> en zeezicht.</p>',
        },
      }),
    ];
    expect(extractFromPageBlocks(blocks, 'nl')).toBe(
      'Onze villa biedt 4 slaapkamers en zeezicht.'
    );
  });

  it('formats FAQ items as Vraag / Antwoord pairs', () => {
    const blocks = [
      block('faq', {
        items: [
          {
            question_translations: { nl: 'Hoeveel personen?' },
            answer_translations: { nl: 'Maximaal 8 gasten.' },
          },
          {
            question_translations: { nl: 'Kindvriendelijk?' },
            answer_translations: { nl: 'Ja!' },
          },
        ],
      }),
    ];
    const out = extractFromPageBlocks(blocks, 'nl');
    expect(out).toContain('Vraag: Hoeveel personen?');
    expect(out).toContain('Antwoord: Maximaal 8 gasten.');
    expect(out).toContain('Vraag: Kindvriendelijk?');
  });

  it('expands pricing plans with features', () => {
    const blocks = [
      block('pricing', {
        headline_translations: { nl: 'Kies je verblijf' },
        plans: [
          {
            name_translations: { nl: 'Off-Season' },
            price: '€1.500/week',
            features_translations: [
              { nl: 'Tot 8 personen' },
              { nl: 'Schoonmaak inbegrepen' },
            ],
          },
        ],
      }),
    ];
    const out = extractFromPageBlocks(blocks, 'nl');
    expect(out).toContain('Kies je verblijf');
    expect(out).toContain('Off-Season');
    expect(out).toContain('€1.500/week');
    expect(out).toContain('• Tot 8 personen');
  });

  it('writes contact info with email/phone/address labels', () => {
    const blocks = [
      block('contact', {
        email: 'hello@example.com',
        phone: '+599 9 555 1234',
        address: 'Willemstad, Curaçao',
      }),
    ];
    const out = extractFromPageBlocks(blocks, 'nl');
    expect(out).toContain('Email: hello@example.com');
    expect(out).toContain('Telefoon: +599 9 555 1234');
    expect(out).toContain('Adres: Willemstad, Curaçao');
  });

  it('contributes nothing for image-only blocks', () => {
    const blocks = [
      block('image', {
        image_url: 'https://example.com/pool.jpg',
        alt_translations: { nl: 'Privézwembad' },
      }),
    ];
    expect(extractFromPageBlocks(blocks, 'nl')).toBe('');
  });

  it('returns an empty string for an empty block list', () => {
    expect(extractFromPageBlocks([], 'nl')).toBe('');
  });

  it('respects order_index even when blocks arrive out of order', () => {
    const blocks = [
      block(
        'text',
        { content_translations: { nl: 'Tweede paragraaf.' } },
        1
      ),
      block('hero', { headline_translations: { nl: 'Eerste kop' } }, 0),
    ];
    const out = extractFromPageBlocks(blocks, 'nl');
    expect(out.indexOf('Eerste kop')).toBeLessThan(out.indexOf('Tweede paragraaf'));
  });
});

describe('pageDocumentTitle (step 58)', () => {
  const basePage: Page = {
    id: 'p1',
    tenant_id: VILLA_TENANT_ID,
    slug: 'home',
    status: 'published',
    parent_id: null,
    order_index: 0,
    seo_meta: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    published_at: '2026-01-01T00:00:00.000Z',
  };

  it("returns the SEO meta title for the primary locale", () => {
    const page: Page = {
      ...basePage,
      seo_meta: {
        title_translations: { nl: 'Mijn pagina', en: 'My page' },
      },
    };
    expect(pageDocumentTitle(page, 'nl')).toBe('Mijn pagina');
  });

  it('falls back to a humanised slug when no SEO title is set', () => {
    const page: Page = { ...basePage, slug: 'over-ons' };
    expect(pageDocumentTitle(page, 'nl')).toBe('Over Ons');
  });

  it('returns "Homepage" for the home slug fallback', () => {
    expect(pageDocumentTitle(basePage, 'nl')).toBe('Homepage');
  });
});

describe('buildKnowledgeBaseSnapshot (step 58)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('emits one document per published villa page that has content', async () => {
    const docs = await buildKnowledgeBaseSnapshot({
      tenantId: VILLA_TENANT_ID,
      tenantSlug: 'demo-villa',
      agentId: 'agent-1',
      primaryLocale: 'nl',
    });
    expect(docs.length).toBeGreaterThan(0);
    // Every snapshot doc should target the same agent + tenant.
    for (const d of docs) {
      expect(d.agent_id).toBe('agent-1');
      expect(d.tenant_id).toBe(VILLA_TENANT_ID);
      expect(d.type).toBe('page_content');
      expect(d.created_by_user_id).toBeNull();
      expect(d.content.length).toBeGreaterThan(0);
      expect(d.source_url).toMatch(/^\/sites\/demo-villa/);
    }
  });

  it('skips draft pages', async () => {
    const pages = await pagesRepo.listByTenant(VILLA_TENANT_ID);
    const homePage = pages.find((p) => p.slug === 'home');
    expect(homePage).toBeTruthy();
    // Demote home to draft and check it disappears from the snapshot.
    await pagesRepo.update(homePage!.id, { status: 'draft' });
    const docs = await buildKnowledgeBaseSnapshot({
      tenantId: VILLA_TENANT_ID,
      tenantSlug: 'demo-villa',
      agentId: 'agent-1',
      primaryLocale: 'nl',
    });
    expect(docs.find((d) => d.page_id === homePage!.id)).toBeUndefined();
  });

  it("skips pages whose blocks produce no textual content", async () => {
    // Stand up a fresh page with only an image block and verify it's
    // not in the snapshot.
    const page = await pagesRepo.create({
      tenant_id: VILLA_TENANT_ID,
      slug: 'image-only',
      status: 'published',
      parent_id: null,
      order_index: 99,
      seo_meta: null,
      published_at: '2026-01-01T00:00:00.000Z',
    });
    await blocksRepo.create({
      page_id: page.id,
      block_type: 'image',
      order_index: 0,
      data: {
        image_url: 'https://example.com/x.jpg',
        alt_translations: { nl: 'Alleen plaatje' },
      },
    });
    const docs = await buildKnowledgeBaseSnapshot({
      tenantId: VILLA_TENANT_ID,
      tenantSlug: 'demo-villa',
      agentId: 'agent-1',
      primaryLocale: 'nl',
    });
    expect(docs.find((d) => d.page_id === page.id)).toBeUndefined();
  });
});
