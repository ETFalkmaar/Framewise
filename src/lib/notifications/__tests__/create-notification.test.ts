import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { notificationsRepo, resetStore } from '@/lib/data';
import {
  notifyClientOfApproval,
  notifyClientOfRejection,
  notifySuperAdminsOfPublishRequest,
} from '@/lib/notifications/create-notification';

/**
 * Step 48 — notify helpers. Verify the user-id targeting, action_url
 * shapes, and that the rejection notes land in the body.
 */

const SUPER_ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const VILLA_OWNER_ID = 'a0000000-0000-0000-0000-000000000002';
const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';

describe('notifySuperAdminsOfPublishRequest (step 48)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('creates one notification per super-admin', async () => {
    await notifySuperAdminsOfPublishRequest({
      tenantId: VILLA_TENANT_ID,
      tenantName: 'Demo Villa',
      requestedByUserId: VILLA_OWNER_ID,
      requestedByUserName: 'Villa Owner',
    });

    const admin = await notificationsRepo.listByUser(SUPER_ADMIN_ID);
    expect(admin.length).toBe(1);
    expect(admin[0].type).toBe('publish_requested');
    expect(admin[0].title).toContain('Demo Villa');
    expect(admin[0].body).toContain('Villa Owner');
    expect(admin[0].action_url).toBe(`/admin/tenants/${VILLA_TENANT_ID}`);
  });

  it('does not notify a tenant owner (only super-admins)', async () => {
    await notifySuperAdminsOfPublishRequest({
      tenantId: VILLA_TENANT_ID,
      tenantName: 'Demo Villa',
      requestedByUserId: VILLA_OWNER_ID,
      requestedByUserName: 'Villa Owner',
    });

    const ownerNotifs = await notificationsRepo.listByUser(VILLA_OWNER_ID);
    expect(ownerNotifs.length).toBe(0);
  });
});

describe('notifyClientOfApproval (step 48)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('writes a publish_approved notification with the right action_url', async () => {
    await notifyClientOfApproval({
      tenantId: VILLA_TENANT_ID,
      userId: VILLA_OWNER_ID,
      approvedByUserName: 'Framewise Admin',
    });
    const list = await notificationsRepo.listByUser(VILLA_OWNER_ID);
    expect(list.length).toBe(1);
    expect(list[0].type).toBe('publish_approved');
    expect(list[0].title).toContain('🎉');
    expect(list[0].body).toContain('Framewise Admin');
    expect(list[0].action_url).toBe('/account');
  });
});

describe('notifyClientOfRejection (step 48)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('includes the rejection notes in the body', async () => {
    const notes = 'Logo is nog niet juist geplaatst';
    await notifyClientOfRejection({
      tenantId: VILLA_TENANT_ID,
      userId: VILLA_OWNER_ID,
      rejectedByUserName: 'Framewise Admin',
      notes,
    });
    const list = await notificationsRepo.listByUser(VILLA_OWNER_ID);
    expect(list.length).toBe(1);
    expect(list[0].type).toBe('publish_rejected');
    expect(list[0].body).toContain(notes);
    expect(list[0].action_url).toBe('/account');
  });
});
