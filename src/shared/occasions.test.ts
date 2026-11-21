import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_NAMES, COVERED, fallsOnWeekend, greetingDraft, hijriOf, makeIcs, OCCASIONS, upcomingOccasions } from './occasions.ts';

const FROM = new Date(Date.UTC(2026, 10, 20));
const ymd = (d: Date) => d.toISOString().slice(0, 10);

test('every national occasion has a valid fixed date and a known country', () => {
  for (const o of OCCASIONS.filter((x) => x.kind !== 'religious')) {
    assert.ok(COUNTRY_NAMES[o.countries[0]], o.id);
    assert.ok(o.month! >= 1 && o.month! <= 12 && o.day! >= 1 && o.day! <= 31, o.id);
  }
  assert.equal(new Set(OCCASIONS.map((o) => o.id)).size, OCCASIONS.length);
  assert.ok(COVERED.length >= 12);
});

test('fixed national days land on the right date in the next year', () => {
  const list = upcomingOccasions({ from: FROM, days: 400, includeReligious: false });
  const find = (id: string) => ymd(list.find((x) => x.def.id === id)!.date);
  assert.equal(find('KW-NAT'), '2027-02-25');
  assert.equal(find('SA-NAT'), '2027-09-23');
  assert.equal(find('AE-NAT'), '2026-12-02');
  assert.equal(find('QA-NAT'), '2026-12-18');
  assert.equal(find('OM-NAT'), '2027-11-18');
});

test('results are sorted and daysUntil counts from the start date', () => {
  const list = upcomingOccasions({ from: FROM, days: 200 });
  for (let i = 1; i < list.length; i++) assert.ok(list[i].date.getTime() >= list[i - 1].date.getTime());
  assert.equal(list[0].daysUntil, Math.round((list[0].date.getTime() - FROM.getTime()) / 86400000));
});

test('country filter and religious toggle', () => {
  const onlyKw = upcomingOccasions({ from: FROM, days: 400, countries: ['KW'], includeReligious: false });
  assert.ok(onlyKw.length > 0 && onlyKw.every((x) => x.country === 'KW'));
  const withRel = upcomingOccasions({ from: FROM, days: 400, countries: ['KW'] });
  assert.ok(withRel.some((x) => x.def.kind === 'religious'));
});

test('Hijri occasions fall in the expected windows (Umm al-Qura, approximate)', () => {
  const list = upcomingOccasions({ from: FROM, days: 420 });
  const within = (id: string, a: string, b: string) => {
    const d = ymd(list.find((x) => x.def.id === id)!.date);
    assert.ok(d >= a && d <= b, `${id} ${d}`);
  };
  within('REL-RAMADAN', '2027-02-07', '2027-02-10');
  within('REL-FITR', '2027-03-08', '2027-03-11');
  within('REL-ADHA', '2027-05-15', '2027-05-18');
  within('REL-NEWYEAR', '2027-06-05', '2027-06-08');
  assert.ok(list.filter((x) => x.def.kind === 'religious').every((x) => x.approx));
});

test('known Hijri anchors', () => {
  assert.deepEqual(hijriOf(new Date(Date.UTC(2026, 1, 18))), { year: 1447, month: 9, day: 1 });
});

test('weekend detection follows each country (UAE is Saturday-Sunday, Kuwait Friday-Saturday)', () => {
  const friday = new Date(Date.UTC(2026, 10, 20));
  const sunday = new Date(Date.UTC(2026, 10, 22));
  assert.equal(fallsOnWeekend('KW', friday), true);
  assert.equal(fallsOnWeekend('AE', friday), false);
  assert.equal(fallsOnWeekend('AE', sunday), true);
  assert.equal(fallsOnWeekend(undefined, friday), false);
});

test('greetings: offered for national days and Eids, never for Ashura or Commemoration Day', () => {
  const by = (id: string) => OCCASIONS.find((o) => o.id === id)!;
  const ar = greetingDraft(by('KW-NAT'), 'KW', 'ar')!;
  assert.ok(ar.includes('اليوم الوطني') && ar.includes('الكويت'));
  const en = greetingDraft(by('SA-NAT'), 'SA', 'en')!;
  assert.ok(en.includes('National Day') && en.includes('Saudi Arabia'));
  assert.ok(greetingDraft(by('REL-FITR'), undefined, 'ar')!.includes('عيد الفطر'));
  assert.equal(greetingDraft(by('REL-ASHURA'), undefined, 'ar'), null);
  assert.equal(greetingDraft(by('AE-COM'), 'AE', 'ar'), null);
});

test('ICS output is a valid all-day calendar with a 7-day reminder and escaped text', () => {
  const list = upcomingOccasions({ from: FROM, days: 60, countries: ['AE'], includeReligious: false }).filter((x) => x.def.id === 'AE-NAT');
  const ics = makeIcs(list, 'en', FROM);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261202'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261203'));
  assert.ok(ics.includes('TRIGGER:-P7D'));
  assert.ok(ics.includes('UID:AE-NAT-AE-20261202@wijaha.web.app'));
  assert.ok(!ics.replace(/\r\n/g, '').includes('\n'), 'no bare newlines');
});

test('source links match the knowledge-base verified sources', async () => {
  const { VERIFIED_SOURCES } = await import('../db/seed-data.ts');
  const { SOURCE_LINKS } = await import('./occasions.ts');
  const byId = new Map<string, string>(VERIFIED_SOURCES.map((s) => [s.id as string, s.url as string]));
  for (const [id, link] of Object.entries(SOURCE_LINKS)) assert.equal(byId.get(id), link.url, id);
  for (const o of OCCASIONS) for (const id of o.sourceIds ?? []) assert.ok(SOURCE_LINKS[id], `${o.id} -> ${id}`);
});
