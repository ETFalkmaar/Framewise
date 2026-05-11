import type { Booking, Tenant } from '@/types/database';

/**
 * RFC 5545 ICS generator (step 55, fase 14 finale). Produces a
 * minimal but spec-compliant `text/calendar` payload that
 * Google Calendar, Apple Calendar, and Outlook all parse without
 * complaint.
 *
 * Scope intentionally small — we emit `VEVENT` records with the
 * fields the booking surface needs (UID, SUMMARY, DESCRIPTION,
 * LOCATION, DTSTART/DTEND in UTC, STATUS, ORGANIZER, ATTENDEE,
 * CREATED, LAST-MODIFIED). Future work (TZID handling for
 * tenant_booking_timezone, recurring events, attachments) lands
 * later in the roadmap.
 */

export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  status: 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE';
  organizer?: { name: string; email: string };
  attendee?: { name: string; email: string };
  created: Date;
  lastModified: Date;
}

const CRLF = '\r\n';
const PRODID = '-//Framewise//Bookings//EN';

/**
 * Wrap output in RFC 5545 VCALENDAR header/footer plus one VEVENT
 * per input. Lines are joined with CRLF (the spec requires it) and
 * the whole payload is folded at 75 octets, also per spec.
 */
export function generateICS(events: ICSEvent[], calendarName: string): string {
  const out: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
    'METHOD:PUBLISH',
  ];
  for (const event of events) {
    out.push(...renderEvent(event));
  }
  out.push('END:VCALENDAR');
  return out.map(foldLine).join(CRLF) + CRLF;
}

function renderEvent(event: ICSEvent): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatICSDate(event.lastModified)}`,
    `DTSTART:${formatICSDate(event.startTime)}`,
    `DTEND:${formatICSDate(event.endTime)}`,
    `SUMMARY:${escapeICSText(event.summary)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeICSText(event.location)}`);
  lines.push(`STATUS:${event.status}`);
  if (event.organizer) {
    lines.push(
      `ORGANIZER;CN=${escapeICSParam(event.organizer.name)}:MAILTO:${event.organizer.email}`
    );
  }
  if (event.attendee) {
    lines.push(
      `ATTENDEE;CN=${escapeICSParam(event.attendee.name)};RSVP=FALSE:MAILTO:${event.attendee.email}`
    );
  }
  lines.push(`CREATED:${formatICSDate(event.created)}`);
  lines.push(`LAST-MODIFIED:${formatICSDate(event.lastModified)}`);
  lines.push('END:VEVENT');
  return lines;
}

/**
 * RFC 5545 date-time UTC: `YYYYMMDDTHHmmssZ`. The conversion drops
 * milliseconds because the spec doesn't allow sub-second precision
 * inside DTSTART / DTEND.
 */
export function formatICSDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Escape the four characters RFC 5545 calls out in TEXT values
 * (commas, semicolons, newlines, backslashes). Carriage returns and
 * lone line-feeds are folded to literal "\\n".
 */
export function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/[\r\n]/g, '\\n');
}

/**
 * Param values (used in ORGANIZER;CN=, ATTENDEE;CN=) follow slightly
 * different rules — double-quote if the value contains whitespace,
 * commas, or colons. Names like "Ann van der Berg" need quoting.
 */
function escapeICSParam(value: string): string {
  if (/[",:;]/.test(value) || /\s/.test(value)) {
    return `"${value.replace(/"/g, "'")}"`;
  }
  return value;
}

/**
 * RFC 5545 line-folding: lines longer than 75 octets must be split
 * with `\r\n ` (CRLF + single space).
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < line.length) {
    const chunkSize = cursor === 0 ? 75 : 74;
    chunks.push(line.slice(cursor, cursor + chunkSize));
    cursor += chunkSize;
  }
  return chunks.join(CRLF + ' ');
}

/**
 * Convert a `Booking` row into an `ICSEvent`. UID uses the tenant
 * id + reference code so the same booking is stable across feed
 * refreshes (calendars de-dupe on UID). `STATUS` derives from the
 * booking lifecycle — pending becomes TENTATIVE, confirmed becomes
 * CONFIRMED, anything else CANCELLED.
 */
export function bookingToICSEvent(booking: Booking, tenant: Tenant, baseUrl: string): ICSEvent {
  const partyLabel = booking.party_size === 1 ? '1 persoon' : `${booking.party_size} personen`;
  const summary = `Reservering: ${booking.customer_name} (${partyLabel})`;

  const descriptionLines: string[] = [
    `Referentie: ${booking.reference_code}`,
    `Klant: ${booking.customer_name}`,
    `Email: ${booking.customer_email}`,
  ];
  if (booking.customer_phone) descriptionLines.push(`Telefoon: ${booking.customer_phone}`);
  if (booking.notes) descriptionLines.push(`Notities: ${booking.notes}`);
  descriptionLines.push(
    `Bekijk: ${baseUrl}/sites/${tenant.slug}/booking/${booking.reference_code}?email=${encodeURIComponent(booking.customer_email)}`
  );

  let status: ICSEvent['status'];
  if (booking.status === 'cancelled') status = 'CANCELLED';
  else if (booking.status === 'pending') status = 'TENTATIVE';
  else if (booking.status === 'confirmed') status = 'CONFIRMED';
  else status = 'CANCELLED'; // no_show / completed both treated as cancelled

  return {
    uid: `booking-${booking.id}@framewise.com`,
    summary,
    description: descriptionLines.join('\\n'),
    location: tenant.name,
    startTime: new Date(booking.start_time),
    endTime: new Date(booking.end_time),
    status,
    organizer: { name: tenant.name, email: `bookings@${tenant.slug}.framewise.app` },
    attendee: { name: booking.customer_name, email: booking.customer_email },
    created: new Date(booking.created_at),
    lastModified: new Date(booking.updated_at),
  };
}
