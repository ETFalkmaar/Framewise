import { NextRequest } from 'next/server';

import { bookingToICSEvent, generateICS } from '@/lib/bookings/ics-generator';
import { bookingsRepo, tenantsRepo } from '@/lib/data';

/**
 * Tenant calendar feed (step 55, fase 14 finale).
 *
 * GET `/api/tenants/<tenantId>/calendar.ics?token=<feed-token>`
 *
 * Subscribable feed the tenant owner generates from
 * `/account/bookings/calendar`. Returns the next 90 days of
 * confirmed + pending bookings as a single VCALENDAR, suitable for
 * Google / Apple / Outlook subscriptions.
 *
 * Cancelled bookings are excluded — the slot generator side never
 * surfaces them as live events either, so the calendar mirrors what
 * the operator actually needs to plan around.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<Response> {
  const { tenantId } = await params;
  const token = request.nextUrl.searchParams.get('token');

  const tenant = await tenantsRepo.findById(tenantId);
  if (!tenant) {
    return new Response('Not found', { status: 404 });
  }
  if (!tenant.calendar_feed_token || !token || tenant.calendar_feed_token !== token) {
    return new Response('Unauthorized', { status: 403 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const bookings = await bookingsRepo.listByTenant(tenantId, {
    from: now.toISOString(),
    to: horizon.toISOString(),
    status: ['pending', 'confirmed'],
  });

  const baseUrl = request.nextUrl.origin;
  const events = bookings.map((b) => bookingToICSEvent(b, tenant, baseUrl));
  const ics = generateICS(events, `${tenant.name} — Reserveringen`);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${tenant.slug}-calendar.ics"`,
      // Allow short-lived caching so Apple/Google clients don't hammer
      // us on every refresh, but still re-fetch within a reasonable
      // window after the operator confirms/cancels a booking.
      'Cache-Control': 'public, max-age=300',
    },
  });
}
