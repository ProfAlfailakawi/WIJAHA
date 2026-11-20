/** One event file that feeds the invitation, run sheet, calendar entry and readiness checks. Pure functions. */
import { COVERED, upcomingOccasions, type Upcoming } from '../occasions.ts';
import { TEMPLATES } from './live.ts';

export interface EventFile {
  name: string;
  templateId: string;
  /** Local date-time as typed in a datetime-local input: YYYY-MM-DDTHH:mm. */
  start: string;
  venue: string;
  hostName: string;
  hostTitle: string;
  dress: string;
  rsvp: string;
}

export const EMPTY_EVENT: EventFile = { name: '', templateId: TEMPLATES[0].id, start: '', venue: '', hostName: '', hostTitle: '', dress: '', rsvp: '' };

const RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function parseStart(s: string): { y: number; m: number; d: number; hh: number; mm: number } | null {
  const m = RE.exec(s);
  if (!m) return null;
  const [y, mo, d, hh, mm] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  return { y, m: mo, d, hh, mm };
}

/** The calendar day as a UTC midnight date (what the occasions module compares with). */
export function dayOf(s: string): Date | null {
  const p = parseStart(s);
  return p ? new Date(Date.UTC(p.y, p.m - 1, p.d)) : null;
}

export function clashesFor(ev: EventFile, countries: string[], includeReligious = true): Upcoming[] {
  const day = dayOf(ev.start);
  if (!day) return [];
  const list = countries.filter((c) => COVERED.includes(c));
  return upcomingOccasions({ from: day, days: 0, countries: list.length ? list : undefined, includeReligious }).filter((u) => u.date.getTime() === day.getTime());
}

function fmtDate(day: Date, locale: 'ar' | 'en', cal: 'gregory' | 'hijri'): string {
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB-u';
  const ext = cal === 'hijri' ? `${tag}-ca-islamic-umalqura` : `${tag}-ca-gregory`;
  return new Intl.DateTimeFormat(ext, { weekday: cal === 'gregory' ? 'long' : undefined, day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(day);
}

export function buildInvitation(ev: EventFile, locale: 'ar' | 'en'): string {
  const day = dayOf(ev.start);
  const p = parseStart(ev.start);
  const time = p ? `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}` : '';
  const host = [ev.hostTitle, ev.hostName].filter(Boolean).join(' ');
  const lines: string[] = [];
  if (locale === 'ar') {
    if (host) lines.push(`يتشرف ${host}`);
    lines.push(`بدعوتكم لحضور ${ev.name || '………'}`);
    if (day) lines.push(`وذلك يوم ${fmtDate(day, 'ar', 'gregory')} الموافق ${fmtDate(day, 'ar', 'hijri')} (تقريبي)`);
    if (time) lines.push(`الساعة ${time}`);
    if (ev.venue) lines.push(`المكان: ${ev.venue}`);
    if (ev.dress) lines.push(`الزي: ${ev.dress}`);
    if (ev.rsvp) lines.push(`يرجى تأكيد الحضور: ${ev.rsvp}`);
  } else {
    if (host) lines.push(`${host}`);
    lines.push(`requests the pleasure of your company at ${ev.name || '………'}`);
    if (day) lines.push(`on ${fmtDate(day, 'en', 'gregory')} (${fmtDate(day, 'en', 'hijri')} AH, approximate)`);
    if (time) lines.push(`at ${time}`);
    if (ev.venue) lines.push(`Venue: ${ev.venue}`);
    if (ev.dress) lines.push(`Dress code: ${ev.dress}`);
    if (ev.rsvp) lines.push(`RSVP: ${ev.rsvp}`);
  }
  return lines.join('\n');
}

export interface Readiness {
  id: string;
  ok: boolean;
  ar: string;
  en: string;
}

export function readiness(ev: EventFile, ctx: { guests: number; clashes: Upcoming[]; now?: Date }): Readiness[] {
  const p = parseStart(ev.start);
  const day = dayOf(ev.start);
  const now = ctx.now ?? new Date();
  const future = !!day && day.getTime() >= Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return [
    { id: 'name', ok: ev.name.trim().length > 2, ar: 'اسم الفعالية محدد', en: 'The event has a name' },
    { id: 'when', ok: !!p && future, ar: 'التاريخ والوقت محددان وفي المستقبل', en: 'Date and time are set and in the future' },
    { id: 'venue', ok: ev.venue.trim().length > 2, ar: 'المكان محدد', en: 'The venue is set' },
    { id: 'host', ok: ev.hostName.trim().length > 1, ar: 'المضيف محدد (لبناء الجلوس والدعوة)', en: 'The host is set (for seating and the invitation)' },
    { id: 'dress', ok: ev.dress.trim().length > 1, ar: 'الزي مذكور في الدعوة', en: 'Dress code is stated' },
    { id: 'rsvp', ok: ev.rsvp.trim().length > 3, ar: 'وسيلة تأكيد الحضور مذكورة', en: 'A way to confirm attendance is given' },
    { id: 'guests', ok: ctx.guests > 0, ar: 'قائمة الضيوف جاهزة في مولّد الجلوس', en: 'A guest list exists in the seating studio' },
    { id: 'clash', ok: ctx.clashes.length === 0, ar: 'لا تعارض مع يوم وطني أو ديني لشركائك', en: 'No clash with a partner’s national or religious day' },
  ];
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const pad = (n: number) => String(n).padStart(2, '0');

/** A floating-time VEVENT (no time zone claimed), one hour default length, with day-before and 2-hour reminders. */
export function eventIcs(ev: EventFile, locale: 'ar' | 'en', now = new Date()): string | null {
  const p = parseStart(ev.start);
  if (!p) return null;
  const tpl = TEMPLATES.find((t) => t.id === ev.templateId) ?? TEMPLATES[0];
  const last = Math.max(...tpl.steps.map((s) => s.at + s.mins));
  const endMin = p.hh * 60 + p.mm + Math.max(60, last);
  const endDay = new Date(Date.UTC(p.y, p.m - 1, p.d + Math.floor(endMin / 1440)));
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const dt = (y: number, m: number, d: number, mins: number) => `${y}${pad(m)}${pad(d)}T${pad(Math.floor((mins % 1440) / 60))}${pad(mins % 60)}00`;
  const uid = `event-${p.y}${pad(p.m)}${pad(p.d)}${pad(p.hh)}${pad(p.mm)}@wijaha`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WIJAHA//Event//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${stamp}`,
    `DTSTART:${dt(p.y, p.m, p.d, p.hh * 60 + p.mm)}`,
    `DTEND:${dt(endDay.getUTCFullYear(), endDay.getUTCMonth() + 1, endDay.getUTCDate(), endMin)}`,
    `SUMMARY:${esc(ev.name || (locale === 'ar' ? 'فعالية' : 'Event'))}`,
    ...(ev.venue ? [`LOCATION:${esc(ev.venue)}`] : []),
    `DESCRIPTION:${esc(buildInvitation(ev, locale))}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(locale === 'ar' ? 'غداً: ' + ev.name : 'Tomorrow: ' + ev.name)}`, 'TRIGGER:-P1D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.name)}`, 'TRIGGER:-PT2H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
