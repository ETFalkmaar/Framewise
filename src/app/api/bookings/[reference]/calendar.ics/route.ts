import { NextRequest } from 'next/server';

import { bookingToICSEvent, generateICS } from '@/lib/bookings/ics-generator';
import { bookingsRepo, tenantsRepo } from '@/lib/data';

/**
 * Single-booking `.ics` download (step 55, fase 14 finale).
 *
 * GET `/api/bookings/<reference>/calendar.ics?email=<customer-email>`
 *
 * Same email-match guard as the customer self-service page — the
 * customer needs to prove they know the address tied to the booking
 * before we hand them the event. Returns:
 *
 *  - 200 + `text/calendar` body when reference + email match.
 *  - 403 when the email doesn't match (or is omitted).
 *  - 404 when the reference or its tenant can't be resolved.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
): Promise<Response> {
  const { reference } = await params;
  const email = request.nextUrl.searchParams.get('email');

  const booking = await bookingsRepo.findByReferenceCode(reference);
  if (!booking) {
    return new Response('Not found', { status: 404 });
  }

  if (!email || email.toLowerCase() !== booking.customer_email.toLowerCase()) {
    return new Response('Unauthorized', { status: 403 });
  }

  const tenant = await tenantsRepo.findById(booking.tenant_id);
  if (!tenant) {
    return new Response('Not found', { status: 404 });
  }

  const baseUrl = request.nextUrl.origin;
  const event = bookingToICSEvent(booking, tenant, baseUrl);
  const ics = generateICS([event], `Reservering ${tenant.name}`);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="booking-${reference}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
