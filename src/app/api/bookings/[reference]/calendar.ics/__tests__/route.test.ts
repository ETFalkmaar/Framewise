import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import '@/lib/data';

import { bookingsRepo, resetStore, tenantsRepo } from '@/lib/data';
import { GET as singleBookingGET } from '@/app/api/bookings/[reference]/calendar.ics/route';
import { GET as tenantFeedGET } from '@/app/api/tenants/[tenantId]/calendar.ics/route';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const FIRST_BOOKING_REF = 'BK-2026-0001';
const FIRST_BOOKING_EMAIL = 'jonas@example.com';
const BASE_URL = 'https://framewise-pi.vercel.app';

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

describe('GET /api/bookings/[reference]/calendar.ics (step 55)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('200 + text/calendar + attachment on matching email', async () => {
    const req = makeRequest(
      `${BASE_URL}/api/bookings/${FIRST_BOOKING_REF}/calendar.ics?email=${FIRST_BOOKING_EMAIL}`
    );
    const res = await singleBookingGET(req, {
      params: Promise.resolve({ reference: FIRST_BOOKING_REF }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/calendar');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const body = await res.text();
    expect(body).toMatch(/^BEGIN:VCALENDAR/);
    expect(body).toContain(FIRST_BOOKING_REF);
  });

  it('matches email case-insensitively', async () => {
    const req = makeRequest(
      `${BASE_URL}/api/bookings/${FIRST_BOOKING_REF}/calendar.ics?email=JONAS@EXAMPLE.COM`
    );
    const res = await singleBookingGET(req, {
      params: Promise.resolve({ reference: FIRST_BOOKING_REF }),
    });
    expect(res.status).toBe(200);
  });

  it('403 when email is missing', async () => {
    const req = makeRequest(`${BASE_URL}/api/bookings/${FIRST_BOOKING_REF}/calendar.ics`);
    const res = await singleBookingGET(req, {
      params: Promise.resolve({ reference: FIRST_BOOKING_REF }),
    });
    expect(res.status).toBe(403);
  });

  it('403 when email is wrong', async () => {
    const req = makeRequest(
      `${BASE_URL}/api/bookings/${FIRST_BOOKING_REF}/calendar.ics?email=wrong@example.com`
    );
    const res = await singleBookingGET(req, {
      params: Promise.resolve({ reference: FIRST_BOOKING_REF }),
    });
    expect(res.status).toBe(403);
  });

  it('404 for an unknown reference', async () => {
    const req = makeRequest(
      `${BASE_URL}/api/bookings/BK-9999-9999/calendar.ics?email=anyone@example.com`
    );
    const res = await singleBookingGET(req, {
      params: Promise.resolve({ reference: 'BK-9999-9999' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/tenants/[tenantId]/calendar.ics (step 55)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  async function arrangeFeed(): Promise<string> {
    // Seeded villa starts with calendar_feed_token=null; flip one on
    // via the repo so we can hit the protected endpoint.
    const token = 'test-token-32chars-abcdefghijklmn';
    await tenantsRepo.update(VILLA_TENANT_ID, { calendar_feed_token: token });
    return token;
  }

  it('200 + text/calendar when the token matches', async () => {
    const token = await arrangeFeed();
    const req = makeRequest(
      `${BASE_URL}/api/tenants/${VILLA_TENANT_ID}/calendar.ics?token=${token}`
    );
    const res = await tenantFeedGET(req, {
      params: Promise.resolve({ tenantId: VILLA_TENANT_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/calendar');
    const body = await res.text();
    expect(body).toMatch(/^BEGIN:VCALENDAR/);
  });

  it('403 when no token is provided', async () => {
    await arrangeFeed();
    const req = makeRequest(`${BASE_URL}/api/tenants/${VILLA_TENANT_ID}/calendar.ics`);
    const res = await tenantFeedGET(req, {
      params: Promise.resolve({ tenantId: VILLA_TENANT_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('403 when the token does not match', async () => {
    await arrangeFeed();
    const req = makeRequest(
      `${BASE_URL}/api/tenants/${VILLA_TENANT_ID}/calendar.ics?token=wrong-token`
    );
    const res = await tenantFeedGET(req, {
      params: Promise.resolve({ tenantId: VILLA_TENANT_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('403 when the tenant has no token configured', async () => {
    const req = makeRequest(
      `${BASE_URL}/api/tenants/${VILLA_TENANT_ID}/calendar.ics?token=any-token`
    );
    const res = await tenantFeedGET(req, {
      params: Promise.resolve({ tenantId: VILLA_TENANT_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('404 for an unknown tenant', async () => {
    const req = makeRequest(
      `${BASE_URL}/api/tenants/00000000-0000-0000-0000-000000000000/calendar.ics?token=x`
    );
    const res = await tenantFeedGET(req, {
      params: Promise.resolve({ tenantId: '00000000-0000-0000-0000-000000000000' }),
    });
    expect(res.status).toBe(404);
  });

  it('excludes cancelled bookings from the feed', async () => {
    const token = await arrangeFeed();
    // Cancel one of the seeded villa bookings.
    const all = await bookingsRepo.listByTenant(VILLA_TENANT_ID);
    expect(all.length).toBeGreaterThan(0);
    const target = all[0];
    await bookingsRepo.update(target.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    });
    const req = makeRequest(
      `${BASE_URL}/api/tenants/${VILLA_TENANT_ID}/calendar.ics?token=${token}`
    );
    const res = await tenantFeedGET(req, {
      params: Promise.resolve({ tenantId: VILLA_TENANT_ID }),
    });
    const body = await res.text();
    // UID for the cancelled booking shouldn't appear.
    expect(body).not.toContain(`booking-${target.id}@framewise.com`);
  });

  it('serves the calendar with a public short-TTL cache header', async () => {
    const token = await arrangeFeed();
    const req = makeRequest(
      `${BASE_URL}/api/tenants/${VILLA_TENANT_ID}/calendar.ics?token=${token}`
    );
    const res = await tenantFeedGET(req, {
      params: Promise.resolve({ tenantId: VILLA_TENANT_ID }),
    });
    expect(res.headers.get('cache-control')).toContain('max-age=');
  });
});
