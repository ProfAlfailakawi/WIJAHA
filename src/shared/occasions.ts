/**
 * National days and religious occasions for the covered countries, with date computation.
 * Fixed dates were checked against published sources (see docs/EXPERT-REVIEW-CHECKLIST.md); Hijri dates use the
 * Umm al-Qura calendar and can differ by a day from local moon sighting, so they are always marked approximate.
 */

export type OccasionKind = 'national' | 'religious' | 'commemoration';

export interface OccasionDef {
  id: string;
  kind: OccasionKind;
  /** ISO codes the occasion belongs to; religious occasions use 'ALL'. */
  countries: string[];
  nameAr: string;
  nameEn: string;
  /** Gregorian fixed date. */
  month?: number;
  day?: number;
  /** Hijri fixed date (approximate). */
  hijri?: { month: number; day: number };
  /** Is the day normally an official holiday? */
  holiday: 'official' | 'varies' | 'observance';
  noteAr?: string;
  noteEn?: string;
  /** Source ids in the knowledge base seed (S-VER-*). */
  sourceIds?: string[];
  /** false when the date has not been confirmed from a published source yet. */
  verified: boolean;
  /** Religious days that call for restraint instead of a greeting. */
  sensitive?: boolean;
  /** Which greeting template applies (none = no draft is offered). */
  greeting?: 'national' | 'eid' | 'ramadan' | 'newyear' | 'none';
}

export const COUNTRY_NAMES: Record<string, { ar: string; en: string }> = {
  KW: { ar: 'الكويت', en: 'Kuwait' },
  SA: { ar: 'السعودية', en: 'Saudi Arabia' },
  AE: { ar: 'الإمارات', en: 'the UAE' },
  QA: { ar: 'قطر', en: 'Qatar' },
  BH: { ar: 'البحرين', en: 'Bahrain' },
  OM: { ar: 'سلطنة عُمان', en: 'Oman' },
  EG: { ar: 'مصر', en: 'Egypt' },
  JO: { ar: 'الأردن', en: 'Jordan' },
  LB: { ar: 'لبنان', en: 'Lebanon' },
  MA: { ar: 'المغرب', en: 'Morocco' },
  TN: { ar: 'تونس', en: 'Tunisia' },
  DZ: { ar: 'الجزائر', en: 'Algeria' },
};

export const COVERED = Object.keys(COUNTRY_NAMES);

/** Published references behind the verified dates (same records as the knowledge base's S-VER sources). */
export const SOURCE_LINKS: Record<string, { title: string; url: string }> = {
  'S-VER-001': { title: 'u.ae — UAE Government', url: 'https://u.ae/en/information-and-services/jobs/Sector-of-employment/working-in-uae-government-sector/working-hours-in-the-public-sector' },
  'S-VER-006': { title: 'timeanddate — Saudi Arabia', url: 'https://timeanddate.com/holidays/saudi-arabia/founding-day' },
  'S-VER-007': { title: 'Gulf News — Kuwait', url: 'https://gulfnews.com/world/gulf/kuwait/kuwait-declares-two-day-public-holiday-for-national-liberation-day-1.500439097' },
  'S-VER-008': { title: 'Gulf News — Oman', url: 'https://gulfnews.com/world/gulf/oman/national-day-holidays-announced-in-oman-for-public-private-sectors-1.500339433' },
  'S-VER-009': { title: 'Gulf Times — Qatar', url: 'https://www.gulf-times.com/story/575039/qatar-national-day-sunday-monday-official-holidays' },
  'S-VER-010': { title: 'Daily Tribune — Bahrain', url: 'https://www.newsofbahrain.com/bahrain/123172.html' },
  'S-VER-011': { title: 'Petra — Jordan News Agency', url: 'https://petra.gov.jo/offiria/index.php/en/news/official-holidays-announced-for-eid-al-adha-independence-day' },
  'S-VER-012': { title: 'legit.ng — Lebanon', url: 'https://www.legit.ng/world/asia/1739981-lebanon-declares-november-23-public-holiday-mark-independence-day-2026/' },
};

/** Weekend days per country (0 = Sunday ... 6 = Saturday). */
export const WEEKEND: Record<string, number[]> = {
  KW: [5, 6], SA: [5, 6], QA: [5, 6], BH: [5, 6], OM: [5, 6], EG: [5, 6], JO: [5, 6], DZ: [5, 6],
  AE: [6, 0], LB: [6, 0], MA: [6, 0], TN: [6, 0],
};

const FIXED = (id: string, c: string, ar: string, en: string, month: number, day: number, extra: Partial<OccasionDef> = {}): OccasionDef => ({
  id, kind: 'national', countries: [c], nameAr: ar, nameEn: en, month, day, holiday: 'official', verified: true, greeting: 'national', ...extra,
});

export const OCCASIONS: OccasionDef[] = [
  FIXED('KW-NAT', 'KW', 'اليوم الوطني', 'National Day', 2, 25, { sourceIds: ['S-VER-007'] }),
  FIXED('KW-LIB', 'KW', 'يوم التحرير', 'Liberation Day', 2, 26, { sourceIds: ['S-VER-007'] }),
  FIXED('SA-FND', 'SA', 'يوم التأسيس', 'Founding Day', 2, 22, { sourceIds: ['S-VER-006'] }),
  FIXED('SA-NAT', 'SA', 'اليوم الوطني', 'National Day', 9, 23, { sourceIds: ['S-VER-006'] }),
  FIXED('AE-NAT', 'AE', 'اليوم الوطني', 'National Day', 12, 2, { sourceIds: ['S-VER-001'] }),
  FIXED('AE-COM', 'AE', 'يوم التذكار', 'Commemoration Day', 11, 30, { kind: 'commemoration', holiday: 'varies', greeting: 'none', noteAr: 'مناسبة وطنية تُحيى بدقيقة صمت وتنكيس الأعلام، وليست عطلة رسمية في كل عام. لا تُرسل تهنئة.', noteEn: 'A national observance marked by a minute of silence and flags at half-mast; not a day off every year. Do not send a greeting.' }),
  FIXED('QA-NAT', 'QA', 'اليوم الوطني', 'National Day', 12, 18, { sourceIds: ['S-VER-009'], noteAr: 'قد يُنقل الديوان الأميري العطلة إذا وافقت عطلة أسبوعية.', noteEn: 'The Amiri Diwan may move the holiday if it falls on a weekend day.' }),
  FIXED('BH-NAT', 'BH', 'العيد الوطني', 'National Day', 12, 16, { sourceIds: ['S-VER-010'] }),
  FIXED('BH-ACC', 'BH', 'يوم الجلوس', 'Accession Day', 12, 17, { sourceIds: ['S-VER-010'] }),
  FIXED('OM-NAT', 'OM', 'اليوم الوطني', 'National Day', 11, 18, { holiday: 'varies', sourceIds: ['S-VER-008'], noteAr: 'تُعلن أيام العطلة سنوياً وقد تُنقل إلى أيام أخرى من الأسبوع.', noteEn: 'Holiday days are announced each year and may be moved to other weekdays.' }),
  FIXED('EG-REV', 'EG', 'ثورة 23 يوليو', 'July 23 Revolution Day', 7, 23),
  FIXED('EG-ARM', 'EG', 'يوم القوات المسلحة', 'Armed Forces Day', 10, 6, { noteAr: 'قد تُمنح عطلة بديلة إذا وافق عطلة أسبوعية.', noteEn: 'A substitute day off may be granted if it falls on a weekend day.' }),
  FIXED('JO-IND', 'JO', 'عيد الاستقلال', 'Independence Day', 5, 25, { sourceIds: ['S-VER-011'], noteAr: 'قد تنقل الحكومة العطلة إلى يوم آخر لتمديد الإجازة.', noteEn: 'The government may move the holiday to another day to extend the break.' }),
  FIXED('LB-IND', 'LB', 'عيد الاستقلال', 'Independence Day', 11, 22, { sourceIds: ['S-VER-012'], noteAr: 'قد تنقل الحكومة العطلة إذا وافقت يوم عطلة.', noteEn: 'The government may move the holiday if it falls on a day off.' }),
  FIXED('MA-THR', 'MA', 'عيد العرش', 'Throne Day', 7, 30),
  FIXED('TN-IND', 'TN', 'عيد الاستقلال', 'Independence Day', 3, 20),
  FIXED('DZ-IND', 'DZ', 'عيد الاستقلال', 'Independence Day', 7, 5, { verified: false }),
  // Religious (Hijri, approximate)
  { id: 'REL-NEWYEAR', kind: 'religious', countries: ['ALL'], nameAr: 'رأس السنة الهجرية', nameEn: 'Islamic New Year', hijri: { month: 1, day: 1 }, holiday: 'varies', verified: true, greeting: 'newyear', noteAr: 'عطلة رسمية في عدد من الدول، ويتبع الهلال.', noteEn: 'An official holiday in several countries; follows the moon.' },
  { id: 'REL-ASHURA', kind: 'religious', countries: ['ALL'], nameAr: 'عاشوراء', nameEn: 'Ashura', hijri: { month: 1, day: 10 }, holiday: 'varies', verified: true, sensitive: true, greeting: 'none', noteAr: 'مناسبة دينية حساسة في بعض الدول (كالبحرين والعراق ولبنان)؛ تُتجنَّب الفعاليات الاحتفالية ولا تُرسل تهنئة.', noteEn: 'A sensitive religious observance in some countries (such as Bahrain, Iraq and Lebanon); avoid celebratory events and do not send a greeting.' },
  { id: 'REL-MAWLID', kind: 'religious', countries: ['ALL'], nameAr: 'المولد النبوي', nameEn: "Prophet's Birthday", hijri: { month: 3, day: 12 }, holiday: 'varies', verified: true, greeting: 'none', noteAr: 'عطلة رسمية في بعض الدول دون غيرها؛ تُراجَع عادة البلد قبل إرسال أي تهنئة.', noteEn: 'An official holiday in some countries but not others; check local custom before sending any greeting.' },
  { id: 'REL-RAMADAN', kind: 'religious', countries: ['ALL'], nameAr: 'بداية شهر رمضان', nameEn: 'Start of Ramadan', hijri: { month: 9, day: 1 }, holiday: 'observance', verified: true, greeting: 'ramadan', noteAr: 'تُقصَّر ساعات العمل وتتغير الجداول؛ يبدأ التخطيط قبلها بأسبوعين.', noteEn: 'Working hours shorten and schedules change; start planning two weeks ahead.' },
  { id: 'REL-FITR', kind: 'religious', countries: ['ALL'], nameAr: 'عيد الفطر', nameEn: 'Eid al-Fitr', hijri: { month: 10, day: 1 }, holiday: 'official', verified: true, greeting: 'eid', noteAr: 'عطلة تمتد عدة أيام ويحددها رؤية الهلال.', noteEn: 'A holiday of several days set by moon sighting.' },
  { id: 'REL-ARAFAT', kind: 'religious', countries: ['ALL'], nameAr: 'يوم عرفة', nameEn: 'Day of Arafat', hijri: { month: 12, day: 9 }, holiday: 'official', verified: true, greeting: 'none', noteAr: 'عطلة رسمية في عدد من الدول.', noteEn: 'An official holiday in several countries.' },
  { id: 'REL-ADHA', kind: 'religious', countries: ['ALL'], nameAr: 'عيد الأضحى', nameEn: 'Eid al-Adha', hijri: { month: 12, day: 10 }, holiday: 'official', verified: true, greeting: 'eid', noteAr: 'عطلة تمتد عدة أيام ويحددها رؤية الهلال.', noteEn: 'A holiday of several days set by moon sighting.' },
];

// ---------------------------------------------------------------- dates

const DAY = 86400000;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const startOfDayUtc = (d: Date) => utc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());

const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });

export function hijriOf(date: Date): { year: number; month: number; day: number } {
  const parts = hijriFmt.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export interface Upcoming {
  def: OccasionDef;
  date: Date;
  daysUntil: number;
  /** Country the entry was expanded for (national days) or undefined for religious occasions. */
  country?: string;
  approx: boolean;
  weekday: number;
  hijriLabel?: string;
}

export function upcomingOccasions(opts: { from: Date; days?: number; countries?: string[]; includeReligious?: boolean }): Upcoming[] {
  const from = startOfDayUtc(opts.from);
  const days = opts.days ?? 400;
  const countries = opts.countries && opts.countries.length > 0 ? opts.countries : COVERED;
  const includeReligious = opts.includeReligious ?? true;
  const out: Upcoming[] = [];
  const end = from.getTime() + days * DAY;

  for (const def of OCCASIONS) {
    if (def.kind !== 'religious') {
      const c = def.countries[0];
      if (!countries.includes(c) || def.month === undefined || def.day === undefined) continue;
      for (const y of [from.getUTCFullYear(), from.getUTCFullYear() + 1, from.getUTCFullYear() + 2]) {
        const date = utc(y, def.month, def.day);
        if (date.getTime() >= from.getTime() && date.getTime() <= end) {
          out.push({ def, date, daysUntil: Math.round((date.getTime() - from.getTime()) / DAY), country: c, approx: false, weekday: date.getUTCDay() });
        }
      }
    } else if (includeReligious && def.hijri) {
      for (let t = from.getTime(); t <= end; t += DAY) {
        const date = new Date(t);
        const h = hijriOf(date);
        if (h.month === def.hijri.month && h.day === def.hijri.day) {
          out.push({ def, date, daysUntil: Math.round((t - from.getTime()) / DAY), approx: true, weekday: date.getUTCDay(), hijriLabel: `${h.day}/${h.month}/${h.year}` });
        }
      }
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.def.id.localeCompare(b.def.id));
}

export function fallsOnWeekend(country: string | undefined, date: Date): boolean {
  if (!country) return false;
  return (WEEKEND[country] ?? []).includes(date.getUTCDay());
}

// ---------------------------------------------------------------- greetings

export function greetingDraft(def: OccasionDef, country: string | undefined, locale: 'ar' | 'en'): string | null {
  const tpl = def.greeting ?? 'none';
  if (tpl === 'none') return null;
  const c = country ? COUNTRY_NAMES[country] : undefined;
  if (locale === 'ar') {
    const place = c ? ` لدولة ${c.ar}` : '';
    switch (tpl) {
      case 'national':
        return `معالي/سعادة ........ المحترم،\n\nبمناسبة ${def.nameAr}${place}، يسرّني أن أتقدّم إلى سعادتكم، ومن خلالكم إلى القيادة والشعب الكريم، بأحرّ التهاني وأطيب التمنيات بدوام التقدم والازدهار.\n\nوتفضلوا بقبول فائق الاحترام والتقدير.\n\n........`;
      case 'eid':
        return `معالي/سعادة ........ المحترم،\n\nبمناسبة ${def.nameAr} المبارك، أتقدّم إليكم بأطيب التهاني وأصدق الأمنيات، سائلاً الله أن يعيده عليكم وعلى الأمة الإسلامية بالخير واليُمن والبركات.\n\nكل عام وأنتم بخير، وتفضلوا بقبول فائق الاحترام والتقدير.\n\n........`;
      case 'ramadan':
        return `معالي/سعادة ........ المحترم،\n\nبمناسبة حلول شهر رمضان المبارك، أتقدّم إليكم بأطيب التهاني، سائلاً الله أن يتقبل منا ومنكم الصيام والقيام وصالح الأعمال.\n\nرمضان كريم، وتفضلوا بقبول فائق الاحترام والتقدير.\n\n........`;
      case 'newyear':
        return `معالي/سعادة ........ المحترم،\n\nبمناسبة حلول العام الهجري الجديد، أتقدّم إليكم بأطيب التهاني وأصدق الأمنيات بعام مليء بالخير والتوفيق.\n\nوتفضلوا بقبول فائق الاحترام والتقدير.\n\n........`;
    }
  }
  const place = c ? ` of ${c.en}` : '';
  switch (tpl) {
    case 'national':
      return `Dear Your Excellency ........,\n\nOn the occasion of the ${def.nameEn}${place}, please accept my warmest congratulations, and convey them to the leadership and the people, with every good wish for continued progress and prosperity.\n\nWith the highest regards,\n\n........`;
    case 'eid':
      return `Dear Your Excellency ........,\n\nOn the blessed occasion of ${def.nameEn}, please accept my warmest wishes. May God bring you, your family and the Muslim world goodness and blessings.\n\nEid Mubarak, and with the highest regards,\n\n........`;
    case 'ramadan':
      return `Dear Your Excellency ........,\n\nAs the blessed month of Ramadan begins, please accept my warm wishes for a month of peace and blessings.\n\nRamadan Kareem, and with the highest regards,\n\n........`;
    case 'newyear':
      return `Dear Your Excellency ........,\n\nOn the Islamic New Year, please accept my best wishes for a year of goodness and success.\n\nWith the highest regards,\n\n........`;
  }
  return null;
}

// ---------------------------------------------------------------- calendar file

const pad = (n: number) => String(n).padStart(2, '0');
const icsDate = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function makeIcs(items: Upcoming[], locale: 'ar' | 'en', now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WIJAHA//Occasions Radar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const stamp = `${icsDate(now)}T000000Z`;
  for (const it of items) {
    const name = locale === 'ar' ? it.def.nameAr : it.def.nameEn;
    const country = it.country ? COUNTRY_NAMES[it.country][locale] : '';
    const summary = country ? `${name} — ${country}` : name;
    const note = (locale === 'ar' ? it.def.noteAr : it.def.noteEn) ?? '';
    const desc = [note, it.approx ? (locale === 'ar' ? 'التاريخ تقريبي ويتبع رؤية الهلال.' : 'Approximate date; follows moon sighting.') : '', 'wijaha.web.app'].filter(Boolean).join(' ');
    const next = new Date(it.date.getTime() + DAY);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${it.def.id}-${it.country ?? 'all'}-${icsDate(it.date)}@wijaha.web.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(it.date)}`,
      `DTEND;VALUE=DATE:${icsDate(next)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'TRIGGER:-P7D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(summary)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
