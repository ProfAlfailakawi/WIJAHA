import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInvitation, clashesFor, dayOf, EMPTY_EVENT, eventIcs, parseStart, readiness } from './event.ts';

const ev = { ...EMPTY_EVENT, name: 'حفل افتتاح المعرض', start: '2027-03-10T19:30', venue: 'فندق الجزيرة', hostName: 'المضيف الاختباري', hostTitle: 'سعادة', dress: 'الزي الرسمي', rsvp: 'rsvp@example.org' };

test('start parsing is strict', () => {
  assert.deepEqual(parseStart('2027-03-10T19:30'), { y: 2027, m: 3, d: 10, hh: 19, mm: 30 });
  assert.equal(parseStart('2027-13-10T19:30'), null);
  assert.equal(parseStart('tomorrow'), null);
  assert.equal(dayOf('x'), null);
});

test('Arabic and English invitations contain every field', () => {
  const ar = buildInvitation(ev, 'ar');
  for (const s of ['سعادة المضيف الاختباري', 'حفل افتتاح المعرض', '19:30', 'فندق الجزيرة', 'الزي الرسمي', 'rsvp@example.org', 'الموافق']) assert.ok(ar.includes(s), s);
  const en = buildInvitation(ev, 'en');
  assert.ok(/RSVP: rsvp@example.org/.test(en) && /at 19:30/.test(en));
});

test('a national day is detected as a clash, an ordinary day is not', () => {
  const nat = clashesFor({ ...ev, start: '2027-02-25T10:00' }, ['KW']);
  assert.ok(nat.length >= 1, 'Kuwait National Day, 25 February');
  assert.equal(clashesFor({ ...ev, start: '2027-03-10T10:00' }, ['KW'], false).length, 0);
});

test('readiness flags missing pieces', () => {
  const r = readiness(EMPTY_EVENT, { guests: 0, clashes: [] });
  assert.equal(r.filter((x) => x.ok).length, 1, 'only the no-clash item is satisfied');
  const full = readiness(ev, { guests: 5, clashes: [], now: new Date('2027-01-01T00:00:00Z') });
  assert.ok(full.every((x) => x.ok));
});

test('ICS is well formed with two reminders', () => {
  const ics = eventIcs(ev, 'ar', new Date('2027-01-01T00:00:00Z'))!;
  assert.ok(ics.startsWith('BEGIN:VCALENDAR') && ics.includes('DTSTART:20270310T193000'));
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 2);
  assert.equal(eventIcs(EMPTY_EVENT, 'ar'), null);
});
