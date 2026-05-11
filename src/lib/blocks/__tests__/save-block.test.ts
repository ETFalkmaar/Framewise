import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { blocksRepo, resetStore } from '@/lib/data';

import { saveBlockContentFor } from '../save-block';

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const RESTAURANT_OWNER_ID = 'a0000000-0000-0000-0000-000000000003';
const STRANGER_ID = 'a0000000-0000-0000-0000-000000000099';
const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';

const VILLA_HOME_TEXT_BLOCK = '10000000-0000-0000-0000-000000000002';
const VILLA_HOME_HERO_BLOCK = '10000000-0000-0000-0000-000000000001';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('saveBlockContentFor', () => {
  it('updates a block.data field (happy path)', async () => {
    const result = await saveBlockContentFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { alignment: 'center' },
    });
    expect(result.success).toBe(true);

    const block = (await blocksRepo.findByPageId('f0000000-0000-0000-0000-000000000001')).find(
      (b) => b.id === VILLA_HOME_TEXT_BLOCK
    );
    expect(block?.data.alignment).toBe('center');
  });

  it('merges nested objects so a single-locale save preserves siblings', async () => {
    // The villa /home text block has content_translations with nl + en.
    const result = await saveBlockContentFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { content_translations: { nl: '<p>Nieuwe NL tekst</p>' } },
    });
    expect(result.success).toBe(true);

    const block = (await blocksRepo.findByPageId('f0000000-0000-0000-0000-000000000001')).find(
      (b) => b.id === VILLA_HOME_TEXT_BLOCK
    );
    const ct = block?.data.content_translations as Record<string, string>;
    expect(ct.nl).toBe('<p>Nieuwe NL tekst</p>');
    // EN should still be there — that's the merge guarantee.
    expect(typeof ct.en).toBe('string');
    expect(ct.en.length).toBeGreaterThan(0);
  });

  it('sanitises HTML payloads (strips <script>)', async () => {
    const result = await saveBlockContentFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: {
        content_translations: {
          nl: '<p>safe</p><script>alert(1)</script>',
        },
      },
    });
    expect(result.success).toBe(true);

    const block = (await blocksRepo.findByPageId('f0000000-0000-0000-0000-000000000001')).find(
      (b) => b.id === VILLA_HOME_TEXT_BLOCK
    );
    const stored = (block?.data.content_translations as Record<string, string>).nl;
    expect(stored).not.toContain('script');
    expect(stored).not.toContain('alert');
    expect(stored).toContain('<p>safe</p>');
  });

  it('does not sanitise plain string fields (e.g. CTA url)', async () => {
    const result = await saveBlockContentFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_HERO_BLOCK,
      newData: { cta_link: '/booking?utm_source=newsletter' },
    });
    expect(result.success).toBe(true);

    const block = (await blocksRepo.findByPageId('f0000000-0000-0000-0000-000000000001')).find(
      (b) => b.id === VILLA_HOME_HERO_BLOCK
    );
    expect(block?.data.cta_link).toBe('/booking?utm_source=newsletter');
  });

  it('lets the super-admin save regardless of plan', async () => {
    const result = await saveBlockContentFor({
      userId: SUPER_ADMIN_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { alignment: 'right' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a stranger', async () => {
    const result = await saveBlockContentFor({
      userId: STRANGER_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { alignment: 'right' },
    });
    expect(result).toEqual({ success: false, errorCode: 'forbidden' });
  });

  it('rejects the restaurant owner from editing villa blocks', async () => {
    const result = await saveBlockContentFor({
      userId: RESTAURANT_OWNER_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { alignment: 'left' },
    });
    expect(result.errorCode).toBe('forbidden');
  });

  it('returns tenant_not_found for an unknown tenant', async () => {
    const result = await saveBlockContentFor({
      userId: SUPER_ADMIN_ID,
      tenantId: '00000000-0000-0000-0000-000000000000',
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { alignment: 'center' },
    });
    expect(result.errorCode).toBe('tenant_not_found');
  });

  it('returns block_not_found for an unknown block', async () => {
    const result = await saveBlockContentFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      blockId: '00000000-0000-0000-0000-000000000000',
      newData: { alignment: 'center' },
    });
    expect(result.errorCode).toBe('block_not_found');
  });

  it('rejects when the block belongs to a different tenant', async () => {
    // restaurant owner trying to save a villa block while sending villa tenantId works (they're forbidden);
    // here villa owner sends restaurant tenantId — block_not_found because scan is scoped to that tenant.
    const result = await saveBlockContentFor({
      userId: VILLA_OWNER_ID,
      tenantId: RESTAURANT_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: { alignment: 'center' },
    });
    // The villa block is not visible when scanning the restaurant's pages.
    expect(result.errorCode).toBe('block_not_found');
  });

  it('returns invalid_payload when newData is not an object', async () => {
    // @ts-expect-error testing runtime guard
    const result = await saveBlockContentFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: null,
    });
    expect(result.errorCode).toBe('invalid_payload');
  });

  it('strips inline event handlers in nested locale strings', async () => {
    const result = await saveBlockContentFor({
      userId: VILLA_OWNER_ID,
      tenantId: VILLA_ID,
      blockId: VILLA_HOME_TEXT_BLOCK,
      newData: {
        content_translations: { nl: '<p onclick="evil()">hi</p>' },
      },
    });
    expect(result.success).toBe(true);
    const block = (await blocksRepo.findByPageId('f0000000-0000-0000-0000-000000000001')).find(
      (b) => b.id === VILLA_HOME_TEXT_BLOCK
    );
    const stored = (block?.data.content_translations as Record<string, string>).nl;
    expect(stored).not.toContain('onclick');
  });

  it('the restaurant owner can save restaurant blocks (Pro plan)', async () => {
    const restaurantHomePageId = 'f0000000-0000-0000-0000-000000000010';
    const blocks = await blocksRepo.findByPageId(restaurantHomePageId);
    if (blocks.length === 0) return;
    const firstBlockId = blocks[0]!.id;
    const result = await saveBlockContentFor({
      userId: RESTAURANT_OWNER_ID,
      tenantId: RESTAURANT_ID,
      blockId: firstBlockId,
      newData: { alignment: 'center' },
    });
    expect(result.success).toBe(true);
  });
});
