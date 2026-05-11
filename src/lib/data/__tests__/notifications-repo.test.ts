import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { notificationsRepo, resetStore } from '@/lib/data';

/**
 * Step 48 — `notificationsRepo` semantics. Covers the surface the
 * bell-dropdown + notifications-page + notify helpers all depend on:
 * insert defaults, sort order, unread filter, limit, count, mark-read
 * idempotency, bulk mark-all-read scope.
 */

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'a0000000-0000-0000-0000-000000000002';
const TENANT = '11111111-1111-1111-1111-111111111111';

describe('mockNotificationsRepo (step 48)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('create() returns a row with id, is_read=false, read_at=null, fresh created_at', async () => {
    const row = await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'publish_requested',
      title: 'Test',
      body: 'Body',
      action_url: '/admin/tenants/x',
    });
    expect(row.id).toBeTruthy();
    expect(row.is_read).toBe(false);
    expect(row.read_at).toBeNull();
    expect(row.created_at).toBeTruthy();
  });

  it('listByUser() returns newest-first', async () => {
    await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'system',
      title: 'first',
      body: '',
      action_url: null,
    });
    // Tiny gap so timestamps differ deterministically.
    await new Promise((r) => setTimeout(r, 5));
    await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'system',
      title: 'second',
      body: '',
      action_url: null,
    });
    const list = await notificationsRepo.listByUser(USER_A);
    expect(list.length).toBe(2);
    expect(list[0].title).toBe('second');
    expect(list[1].title).toBe('first');
  });

  it('listByUser({ unreadOnly: true }) filters out read notifications', async () => {
    const a = await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'system',
      title: 'unread',
      body: '',
      action_url: null,
    });
    const b = await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'system',
      title: 'will-be-read',
      body: '',
      action_url: null,
    });
    await notificationsRepo.markAsRead(b.id);

    const unread = await notificationsRepo.listByUser(USER_A, { unreadOnly: true });
    expect(unread.length).toBe(1);
    expect(unread[0].id).toBe(a.id);
  });

  it('listByUser({ limit }) caps the result set', async () => {
    for (let i = 0; i < 5; i++) {
      await notificationsRepo.create({
        user_id: USER_A,
        tenant_id: TENANT,
        type: 'system',
        title: `n-${i}`,
        body: '',
        action_url: null,
      });
    }
    const list = await notificationsRepo.listByUser(USER_A, { limit: 3 });
    expect(list.length).toBe(3);
  });

  it('listByUser({ offset }) skips items for pagination', async () => {
    const created: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await notificationsRepo.create({
        user_id: USER_A,
        tenant_id: TENANT,
        type: 'system',
        title: `n-${i}`,
        body: '',
        action_url: null,
      });
      created.push(r.id);
      await new Promise((res) => setTimeout(res, 2));
    }
    const page2 = await notificationsRepo.listByUser(USER_A, { offset: 2, limit: 10 });
    expect(page2.length).toBe(2);
  });

  it('countUnreadByUser() reflects mark-as-read', async () => {
    const a = await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'system',
      title: 'a',
      body: '',
      action_url: null,
    });
    await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'system',
      title: 'b',
      body: '',
      action_url: null,
    });
    expect(await notificationsRepo.countUnreadByUser(USER_A)).toBe(2);
    await notificationsRepo.markAsRead(a.id);
    expect(await notificationsRepo.countUnreadByUser(USER_A)).toBe(1);
  });

  it('markAsRead() is idempotent — second call keeps the first read_at', async () => {
    const row = await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'system',
      title: 'a',
      body: '',
      action_url: null,
    });
    await notificationsRepo.markAsRead(row.id);
    const afterFirst = await notificationsRepo.findById(row.id);
    expect(afterFirst?.is_read).toBe(true);
    expect(afterFirst?.read_at).toBeTruthy();

    await new Promise((r) => setTimeout(r, 5));
    await notificationsRepo.markAsRead(row.id);
    const afterSecond = await notificationsRepo.findById(row.id);
    expect(afterSecond?.read_at).toBe(afterFirst?.read_at);
  });

  it('markAllAsRead() returns the count of rows it flipped and scopes to one user', async () => {
    await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'system',
      title: 'a1',
      body: '',
      action_url: null,
    });
    await notificationsRepo.create({
      user_id: USER_A,
      tenant_id: TENANT,
      type: 'system',
      title: 'a2',
      body: '',
      action_url: null,
    });
    // Different user — should NOT be flipped.
    await notificationsRepo.create({
      user_id: USER_B,
      tenant_id: TENANT,
      type: 'system',
      title: 'b1',
      body: '',
      action_url: null,
    });

    const flipped = await notificationsRepo.markAllAsRead(USER_A);
    expect(flipped).toBe(2);
    expect(await notificationsRepo.countUnreadByUser(USER_A)).toBe(0);
    expect(await notificationsRepo.countUnreadByUser(USER_B)).toBe(1);
  });

  it('findById() returns null for unknown ids', async () => {
    const result = await notificationsRepo.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });
});
