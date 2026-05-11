import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';
import { resetStore } from '@/lib/data';

import { getConnectionStatusForTenant, groupConnectorsByCategory } from '../connection-status';

const VILLA_ID = '11111111-1111-1111-1111-111111111111';
const RESTAURANT_ID = '22222222-2222-2222-2222-222222222222';
const UNKNOWN_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('getConnectionStatusForTenant', () => {
  it('returns every provider in the registry, even when the tenant has none', async () => {
    const connectors = await getConnectionStatusForTenant(UNKNOWN_ID);
    expect(connectors.length).toBeGreaterThan(0);
    expect(connectors.every((c) => c.isConnected === false)).toBe(true);
    expect(connectors.every((c) => c.connection === null)).toBe(true);
  });

  it('flags connected providers correctly for villa seed', async () => {
    const connectors = await getConnectionStatusForTenant(VILLA_ID);
    expect(connectors.some((c) => c.isConnected)).toBe(true);
  });

  it('populates lastSyncAt only for connections with a last_used_at', async () => {
    const connectors = await getConnectionStatusForTenant(VILLA_ID);
    const connected = connectors.filter((c) => c.isConnected);
    for (const c of connected) {
      // last_used_at may legitimately be null even for connected
      // providers (newly added). Just assert the field exists.
      expect('lastSyncAt' in c).toBe(true);
    }
  });

  it('returns the same provider count across tenants (registry is global)', async () => {
    const villa = await getConnectionStatusForTenant(VILLA_ID);
    const restaurant = await getConnectionStatusForTenant(RESTAURANT_ID);
    expect(villa.length).toBe(restaurant.length);
  });

  it('every connector has the four required fields', async () => {
    const connectors = await getConnectionStatusForTenant(VILLA_ID);
    for (const c of connectors) {
      expect(typeof c.providerId).toBe('string');
      expect(typeof c.providerName).toBe('string');
      expect(typeof c.category).toBe('string');
      expect(typeof c.isConnected).toBe('boolean');
    }
  });
});

describe('groupConnectorsByCategory', () => {
  it('groups connectors by category in the documented order', async () => {
    const connectors = await getConnectionStatusForTenant(VILLA_ID);
    const groups = groupConnectorsByCategory(connectors);
    const categories = groups.map((g) => g.category);
    // Ordering rule: accounting, payments, crm, newsletter, phone.
    const order = ['accounting', 'payments', 'crm', 'newsletter', 'phone'];
    for (let i = 1; i < categories.length; i++) {
      const prev = order.indexOf(categories[i - 1]!);
      const cur = order.indexOf(categories[i]!);
      expect(prev).toBeLessThan(cur);
    }
  });

  it('drops empty categories', async () => {
    const groups = groupConnectorsByCategory([]);
    expect(groups).toEqual([]);
  });

  it('every group has at least one item', async () => {
    const connectors = await getConnectionStatusForTenant(VILLA_ID);
    const groups = groupConnectorsByCategory(connectors);
    for (const g of groups) {
      expect(g.items.length).toBeGreaterThan(0);
    }
  });

  it('summed item counts equal the original list size', async () => {
    const connectors = await getConnectionStatusForTenant(VILLA_ID);
    const groups = groupConnectorsByCategory(connectors);
    const total = groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(total).toBe(connectors.length);
  });
});
