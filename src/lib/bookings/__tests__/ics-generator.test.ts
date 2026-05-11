import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '@/lib/data';

import { bookingsRepo, resetStore, tenantsRepo } from '@/lib/data';
import {
  bookingToICSEvent,
  escapeICSText,
  formatICSDate,
  generateICS,
  type ICSEvent,
} from '@/lib/bookings/ics-generator';
import type { Booking, Tenant } from '@/types/database';

const VILLA_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const BASE_URL = 'https://framewise-pi.vercel.app';

function fakeEvent(overrides: Partial<ICSEvent> = {}): ICSEvent {
  return {
    uid: 'booking-test@framewise.com',
    summary: 'Reservering: Test (2 personen)',
    description: 'Referentie: BK-2026-0042\\nKlant: Test',
    location: 'Demo Villa',
    startTime: new Date('2026-06-20T18:00:00.000Z'),
    endTime: new Date('2026-06-20T19:30:00.000Z'),
    status: 'CONFIRMED',
    organizer: { name: 'Demo Villa', email: 'bookings@demo-villa.framewise.app' },
    attendee: { name: 'Test', email: 'test@example.com' },
    created: new Date('2026-05-01T10:00:00.000Z'),
    lastModified: new Date('2026-05-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('formatICSDate (step 55)', () => {
  it('emits the RFC 5545 UTC format YYYYMMDDTHHmmssZ', () => {
    expect(formatICSDate(new Date('2026-06-20T18:00:00.000Z'))).toBe('20260620T180000Z');
  });

  it('strips milliseconds — RFC 5545 has no sub-second precision', () => {
    expect(formatICSDate(new Date('2026-06-20T18:00:00.123Z'))).toBe('20260620T180000Z');
  });
});

describe('escapeICSText (step 55)', () => {
  it('escapes commas', () => {
    expect(escapeICSText('one, two')).toBe('one\\, two');
  });
  it('escapes semicolons', () => {
    expect(escapeICSText('a; b')).toBe('a\\; b');
  });
  it('escapes backslashes', () => {
    expect(escapeICSText('a\\b')).toBe('a\\\\b');
  });
  it('escapes newlines to literal \\n', () => {
    expect(escapeICSText('line1\nline2')).toBe('line1\\nline2');
  });
});

describe('generateICS (step 55)', () => {
  it('wraps events with BEGIN:VCALENDAR / END:VCALENDAR', () => {
    const ics = generateICS([fakeEvent()], 'Test Calendar');
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics.trimEnd()).toMatch(/END:VCALENDAR$/);
  });

  it('includes the required RFC 5545 headers (VERSION, PRODID, CALSCALE)', () => {
    const ics = generateICS([fakeEvent()], 'Test Calendar');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//Framewise//Bookings//EN');
    expect(ics).toContain('CALSCALE:GREGORIAN');
  });

  it('exposes the calendar name via X-WR-CALNAME', () => {
    const ics = generateICS([fakeEvent()], 'Demo Villa Reserveringen');
    expect(ics).toContain('X-WR-CALNAME:Demo Villa Reserveringen');
  });

  it('uses CRLF line endings (per spec)', () => {
    const ics = generateICS([fakeEvent()], 'Test');
    expect(ics).toContain('\r\n');
    // No bare LF outside the literal escape sequences.
    const bareLines = ics.split('\r\n').join('').split('\n');
    expect(bareLines.length).toBe(1);
  });

  it('renders one VEVENT per input', () => {
    const ics = generateICS([fakeEvent(), fakeEvent({ uid: 'booking-2@framewise.com' })], 'Test');
    const events = ics.match(/BEGIN:VEVENT/g);
    expect(events?.length).toBe(2);
  });

  it("emits STATUS:CANCELLED when the event is cancelled", () => {
    const ics = generateICS([fakeEvent({ status: 'CANCELLED' })], 'Test');
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('emits STATUS:TENTATIVE for pending bookings', () => {
    const ics = generateICS([fakeEvent({ status: 'TENTATIVE' })], 'Test');
    expect(ics).toContain('STATUS:TENTATIVE');
  });

  it('keeps unicode characters intact for UTF-8 calendar clients', () => {
    const ics = generateICS(
      [fakeEvent({ summary: 'Reservering: Café Übermütig (2)' })],
      'Test'
    );
    expect(ics).toContain('Café Übermütig');
  });

  it('formats DTSTART / DTEND in the expected UTC format', () => {
    const ics = generateICS([fakeEvent()], 'Test');
    expect(ics).toContain('DTSTART:20260620T180000Z');
    expect(ics).toContain('DTEND:20260620T193000Z');
  });

  it('quotes ORGANIZER + ATTENDEE CN values that contain spaces', () => {
    const ics = generateICS(
      [
        fakeEvent({
          attendee: { name: 'Ann van der Berg', email: 'ann@example.com' },
        }),
      ],
      'Test'
    );
    expect(ics).toContain('ATTENDEE;CN="Ann van der Berg";RSVP=FALSE:MAILTO:ann@example.com');
  });

  it('folds long lines at 75 octets', () => {
    const longSummary = 'A'.repeat(200);
    const ics = generateICS([fakeEvent({ summary: longSummary })], 'Test');
    // "SUMMARY:" (8 chars) + 67 A's = 75 octets, then CRLF + space
    // + 74 A's per continuation chunk.
    expect(ics).toMatch(/SUMMARY:A{67}\r\n A{74}/);
  });
});

describe('bookingToICSEvent (step 55)', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  function makeBooking(overrides: Partial<Booking> = {}): Booking {
    return {
      id: 'b-1',
      tenant_id: VILLA_TENANT_ID,
      status: 'confirmed',
      start_date: '2026-06-20',
      end_date: '2026-06-20',
      persons: 2,
      guest_name: 'Test',
      guest_email: 'test@example.com',
      guest_phone: null,
      total_price_cents: 0,
      currency: 'EUR',
      payment_status: 'unpaid',
      payment_provider: null,
      payment_reference: null,
      notes: null,
      booking_type: 'time_slot',
      start_time: '2026-06-20T18:00:00.000Z',
      end_time: '2026-06-20T19:30:00.000Z',
      party_size: 2,
      customer_name: 'Test',
      customer_email: 'test@example.com',
      customer_phone: null,
      internal_notes: null,
      reference_code: 'BK-2026-0042',
      confirmed_at: '2026-05-01T10:00:00.000Z',
      cancelled_at: null,
      cancellation_reason: null,
      no_show_at: null,
      created_at: '2026-05-01T10:00:00.000Z',
      updated_at: '2026-05-01T10:00:00.000Z',
      ...overrides,
    } as Booking;
  }

  async function tenant(): Promise<Tenant> {
    const t = await tenantsRepo.findById(VILLA_TENANT_ID);
    return t!;
  }

  it('uses a stable booking-id UID so calendars de-dupe across refreshes', async () => {
    const event = bookingToICSEvent(makeBooking(), await tenant(), BASE_URL);
    expect(event.uid).toBe('booking-b-1@framewise.com');
  });

  it('maps confirmed booking → STATUS:CONFIRMED', async () => {
    const event = bookingToICSEvent(makeBooking({ status: 'confirmed' }), await tenant(), BASE_URL);
    expect(event.status).toBe('CONFIRMED');
  });

  it('maps pending booking → STATUS:TENTATIVE', async () => {
    const event = bookingToICSEvent(makeBooking({ status: 'pending' }), await tenant(), BASE_URL);
    expect(event.status).toBe('TENTATIVE');
  });

  it('maps cancelled booking → STATUS:CANCELLED', async () => {
    const event = bookingToICSEvent(
      makeBooking({ status: 'cancelled' }),
      await tenant(),
      BASE_URL
    );
    expect(event.status).toBe('CANCELLED');
  });

  it('puts the reference + manage URL in the description', async () => {
    const event = bookingToICSEvent(makeBooking(), await tenant(), BASE_URL);
    expect(event.description).toContain('BK-2026-0042');
    expect(event.description).toContain(`${BASE_URL}/sites/demo-villa/booking/BK-2026-0042`);
  });

  it('sets the attendee to the customer + organiser to the tenant', async () => {
    const event = bookingToICSEvent(makeBooking(), await tenant(), BASE_URL);
    expect(event.attendee?.email).toBe('test@example.com');
    expect(event.organizer?.name).toBe('Demo Villa Curaçao');
  });

  it("includes the customer's phone when present", async () => {
    const event = bookingToICSEvent(
      makeBooking({ customer_phone: '+31 6 12345678' }),
      await tenant(),
      BASE_URL
    );
    expect(event.description).toContain('+31 6 12345678');
  });
});

describe('full end-to-end — generateICS([bookingToICSEvent(seed)])', () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it('produces a parseable feed for the seeded villa bookings', async () => {
    const tenant = (await tenantsRepo.findById(VILLA_TENANT_ID))!;
    const bookings = await bookingsRepo.listByTenant(VILLA_TENANT_ID);
    const events = bookings.map((b) => bookingToICSEvent(b, tenant, BASE_URL));
    const ics = generateICS(events, `${tenant.name} test`);
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics.trimEnd()).toMatch(/END:VCALENDAR$/);
    // Every seed booking should produce one VEVENT block.
    const vevents = ics.match(/BEGIN:VEVENT/g);
    expect(vevents?.length).toBe(bookings.length);
  });
});
