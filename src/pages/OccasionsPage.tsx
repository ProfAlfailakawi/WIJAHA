import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Copy, Download, Mail, Radar, TriangleAlert } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Dialog } from '../components/ui/Primitives';
import { downloadBlob } from '../components/visuals/export.ts';
import { tr } from '../components/visuals/svg-kit.tsx';
import { useI18n } from '../lib/i18n';
import { PartnersGlobe } from '../components/visuals/PartnersGlobe';
import { COUNTRY_NAMES, COVERED, fallsOnWeekend, greetingDraft, makeIcs, SOURCE_LINKS, upcomingOccasions, type Upcoming } from '../shared/occasions.ts';

const KEY = 'wijaha.partners.v1';
const GULF = ['KW', 'SA', 'AE', 'QA', 'BH', 'OM'];

function loadPartners(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as string[] | null;
    return Array.isArray(v) && v.every((c) => COVERED.includes(c)) && v.length > 0 ? v : GULF;
  } catch {
    return GULF;
  }
}

const chip = (active: boolean) =>
  `min-h-[40px] rounded-full border px-4 text-sm font-semibold cursor-pointer transition-colors ${
    active ? 'bg-[var(--primary)] text-[var(--bg)] border-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--ink-2)] border-[var(--line)] hover:text-[var(--ink)]'
  }`;

const KIND_STYLE: Record<string, { tint: string; color: string; ar: string; en: string }> = {
  national: { tint: 'var(--t-gold)', color: 'var(--c-gold)', ar: 'وطنية', en: 'National' },
  commemoration: { tint: 'var(--t-indigo)', color: 'var(--c-indigo)', ar: 'تذكار', en: 'Commemoration' },
  religious: { tint: 'var(--t-teal)', color: 'var(--c-teal)', ar: 'دينية', en: 'Religious' },
};

function whenLabel(days: number, ar: boolean): string {
  if (days === 0) return ar ? 'اليوم' : 'Today';
  if (days === 1) return ar ? 'غداً' : 'Tomorrow';
  if (days === 2 && ar) return 'بعد يومين';
  return ar ? `بعد ${days} يوماً` : `In ${days} days`;
}

function adviceFor(u: Upcoming, ar: boolean): string {
  const id = u.def.id;
  if (id === 'REL-RAMADAN') return ar ? 'ابدأ إعادة جدولة الاجتماعات قبله بأسبوعين.' : 'Start rescheduling meetings two weeks before.';
  if (u.def.sensitive) return ar ? 'تجنّب الفعاليات الاحتفالية في هذا اليوم.' : 'Avoid celebratory events on this day.';
  if (id === 'REL-FITR' || id === 'REL-ADHA') return ar ? 'لا تجدول شيئاً خلال أربعة أيام تقريباً حول التاريخ.' : 'Schedule nothing for about four days around the date.';
  if (u.def.kind === 'commemoration') return ar ? 'احترم المناسبة: لا فعاليات احتفالية ولا رسائل تهنئة.' : 'Respect the occasion: no celebratory events or greetings.';
  return ar ? 'لا تجدول اجتماعاً مع شركائك في هذا اليوم، وأرسل التهنئة قبله بيوم أو يومين.' : 'Do not schedule a meeting with partners that day, and send your greeting a day or two before.';
}

export function OccasionsPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [partners, setPartners] = useState<string[]>(loadPartners);
  const [religious, setReligious] = useState(true);
  const [draftFor, setDraftFor] = useState<Upcoming | null>(null);
  const [draftText, setDraftText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(partners));
    } catch {
      /* not remembered in private mode */
    }
  }, [partners]);

  const today = useMemo(() => new Date(), []);
  const items = useMemo(() => upcomingOccasions({ from: today, days: 380, countries: partners, includeReligious: religious }), [today, partners, religious]);
  const next = items.slice(0, 3);

  const fmt = useMemo(() => new Intl.DateTimeFormat(ar ? 'ar-u-nu-latn-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'UTC' }), [ar]);
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(ar ? 'ar-u-nu-latn-ca-gregory' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), [ar]);
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(ar ? 'ar-u-nu-latn-ca-gregory' : 'en-GB', { weekday: 'short', timeZone: 'UTC' }), [ar]);

  const groups = useMemo(() => {
    const m = new Map<string, Upcoming[]>();
    for (const it of items) {
      const k = monthFmt.format(it.date);
      m.set(k, [...(m.get(k) ?? []), it]);
    }
    return [...m.entries()];
  }, [items, monthFmt]);

  const togglePartner = (c: string) => setPartners((p) => (p.includes(c) ? (p.length > 1 ? p.filter((x) => x !== c) : p) : [...p, c]));

  const openDraft = (u: Upcoming) => {
    setDraftFor(u);
    setDraftText(greetingDraft(u.def, u.country, ar ? 'ar' : 'en') ?? '');
    setCopied(false);
  };

  const downloadIcs = (list: Upcoming[], name: string) =>
    downloadBlob(new Blob([makeIcs(list, ar ? 'ar' : 'en')], { type: 'text/calendar;charset=utf-8' }), name);

  const nameOf = (u: Upcoming) => tr(locale, u.def.nameAr, u.def.nameEn);
  const countryOf = (u: Upcoming) => (u.country ? tr(locale, COUNTRY_NAMES[u.country].ar, COUNTRY_NAMES[u.country].en) : tr(locale, 'كل الدول', 'All countries'));

  const btn = 'min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors';

  return (
    <AppShell>
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <header className="v2-hero !rounded-[28px] px-6 sm:px-10 py-8 sm:py-11 space-y-3">
          <span className="inline-flex items-center gap-2 text-[0.72rem] tracking-[0.35em] text-[var(--gold)] uppercase">
            <Radar className="w-3.5 h-3.5" aria-hidden="true" />
            {ar ? 'رادار المناسبات' : 'Occasions radar'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-[1.2] text-[var(--primary-fg)]">
            {ar ? 'لا تقع في خطأ جدولة مرة أخرى' : 'Never make a scheduling mistake again'}
          </h1>
          <p className="max-w-3xl text-[var(--primary-fg)]/80 leading-relaxed sm:text-lg">
            {ar
              ? 'اختر الدول التي تتعامل معها، فيعرض الرادار أقرب أيامها الوطنية والدينية مع عدّ تنازلي، وتنبيه إذا وافقت عطلتهم الأسبوعية، ومسودة تهنئة جاهزة، وملف تقويم بتنبيه قبل أسبوع.'
              : 'Pick the countries you deal with. The radar shows their next national and religious days with a countdown, flags weekend clashes, drafts a greeting and exports a calendar file with a one-week reminder.'}
          </p>
        </header>

        <section aria-labelledby="partners-h" className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 id="partners-h" className="text-lg font-bold text-[var(--ink)]">{ar ? 'شركائي' : 'My partners'}</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(JSON.stringify(partners) === JSON.stringify(GULF))} onClick={() => setPartners(GULF)}>{ar ? 'دول الخليج' : 'Gulf states'}</button>
              <button type="button" className={chip(partners.length === COVERED.length)} onClick={() => setPartners(COVERED)}>{ar ? 'كل الدول' : 'All countries'}</button>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-2)] cursor-pointer min-h-[40px]">
                <input type="checkbox" checked={religious} onChange={(e) => setReligious(e.target.checked)} className="accent-[var(--gold)] w-4 h-4" />
                {ar ? 'المناسبات الدينية' : 'Religious occasions'}
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={ar ? 'الدول' : 'Countries'}>
            {COVERED.map((c) => (
              <button key={c} type="button" aria-pressed={partners.includes(c)} className={chip(partners.includes(c))} onClick={() => togglePartner(c)} data-testid={`partner-${c}`}>
                {tr(locale, COUNTRY_NAMES[c].ar, COUNTRY_NAMES[c].en)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => downloadIcs(items, 'wijaha-occasions.ics')} disabled={items.length === 0} data-testid="ics-all">
              <Download className="w-4 h-4" aria-hidden="true" />
              {ar ? `حمّل تقويم الـ12 شهراً (${items.length})` : `Download 12-month calendar (${items.length})`}
            </button>
            <span className="text-xs text-[var(--ink-3)] self-center">{ar ? 'اختيارك يُحفظ في متصفحك فقط.' : 'Your choice is saved in your browser only.'}</span>
          </div>
        </section>

        <PartnersGlobe items={items} partners={partners} today={today} ar={ar} />

        {next.length > 0 && (
          <section aria-labelledby="next-h" className="space-y-3">
            <h2 id="next-h" className="text-lg font-bold text-[var(--ink)]">{ar ? 'الأقرب إليك' : 'Coming up next'}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {next.map((u, i) => {
                const k = KIND_STYLE[u.def.kind];
                const weekend = fallsOnWeekend(u.country, u.date);
                return (
                  <article key={`${u.def.id}-${u.country}-${i}`} className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-col gap-3" data-testid="next-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: k.tint, color: k.color }}>{tr(locale, k.ar, k.en)}</span>
                      <span className="text-xs font-semibold text-[var(--ink-3)]">{countryOf(u)}</span>
                    </div>
                    <p className="text-4xl font-extrabold tabular-nums text-[var(--ink)] leading-none" data-testid="countdown">{whenLabel(u.daysUntil, ar)}</p>
                    <div>
                      <h3 className="text-base font-bold text-[var(--ink)]">{nameOf(u)}</h3>
                      <p className="text-sm text-[var(--ink-2)] mt-0.5">{fmt.format(u.date)}{u.approx && <span className="text-[var(--ink-3)]"> · {ar ? 'تقريبي' : 'approx.'}</span>}</p>
                    </div>
                    {weekend && (
                      <p className="text-xs text-[#9a5a00] flex items-start gap-1.5"><TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />{ar ? 'يوافق عطلتهم الأسبوعية؛ قد تُنقل العطلة.' : 'Falls on their weekend; the holiday may be moved.'}</p>
                    )}
                    <p className="text-xs leading-relaxed text-[var(--ink-2)]">{adviceFor(u, ar)}</p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="all-h" className="space-y-6">
          <h2 id="all-h" className="text-lg font-bold text-[var(--ink)]">{ar ? 'كل المناسبات القادمة' : 'All upcoming occasions'}</h2>
          {groups.length === 0 && <p className="text-sm text-[var(--ink-3)]">{ar ? 'لا مناسبات ضمن هذا الاختيار.' : 'No occasions for this selection.'}</p>}
          {groups.map(([month, list]) => (
            <div key={month}>
              <h3 className="text-sm font-bold text-[var(--gold-ink)] mb-2">{month}</h3>
              <ul className="space-y-2">
                {list.map((u, i) => {
                  const k = KIND_STYLE[u.def.kind];
                  const weekend = fallsOnWeekend(u.country, u.date);
                  const note = tr(locale, u.def.noteAr ?? '', u.def.noteEn ?? '');
                  const draft = greetingDraft(u.def, u.country, ar ? 'ar' : 'en');
                  return (
                    <li key={`${u.def.id}-${u.country}-${i}`} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="occasion-row">
                      <div className="w-16 shrink-0 rounded-xl py-2 text-center" style={{ background: k.tint, color: k.color }} aria-hidden="true">
                        <div className="text-2xl font-extrabold tabular-nums leading-none">{u.date.getUTCDate()}</div>
                        <div className="text-[11px] font-semibold mt-1">{dayFmt.format(u.date)}</div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-bold text-[var(--ink)]">
                          {nameOf(u)} <span className="font-medium text-[var(--ink-3)]">· {countryOf(u)}</span>
                        </p>
                        <p className="text-xs text-[var(--ink-2)]">
                          {whenLabel(u.daysUntil, ar)} · {fmt.format(u.date)}{u.approx && ` · ${ar ? `تقريبي (${u.hijriLabel} هـ)` : `approx. (${u.hijriLabel} AH)`}`}
                        </p>
                        {weekend && <p className="text-xs text-[#9a5a00]">{ar ? 'يوافق عطلتهم الأسبوعية؛ قد تُنقل العطلة.' : 'Falls on their weekend; the holiday may be moved.'}</p>}
                        {note && <p className="text-xs text-[var(--ink-3)] leading-relaxed">{note}</p>}
                        <p className="text-xs text-[var(--ink-2)] leading-relaxed">{adviceFor(u, ar)}</p>
                        {!u.def.verified && <p className="text-xs text-[#9a5a00]">{ar ? 'هذا التاريخ لم يُؤكَّد بعد من مصدر منشور.' : 'This date has not yet been confirmed from a published source.'}</p>}
                        {(u.def.sourceIds ?? []).length > 0 && (
                          <p className="text-[11px] text-[var(--ink-3)]">
                            {ar ? 'المصدر: ' : 'Source: '}
                            {(u.def.sourceIds ?? []).map((id, idx) => (
                              <React.Fragment key={id}>
                                {idx > 0 && ' · '}
                                <a href={SOURCE_LINKS[id].url} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--ink)]">{SOURCE_LINKS[id].title}</a>
                              </React.Fragment>
                            ))}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {draft && (
                          <button type="button" className={btn} onClick={() => openDraft(u)} data-testid="draft-btn">
                            <Mail className="w-4 h-4" aria-hidden="true" />
                            {ar ? 'تهنئة' : 'Greeting'}
                          </button>
                        )}
                        <button type="button" className={btn} onClick={() => downloadIcs([u], `wijaha-${u.def.id}.ics`)} aria-label={ar ? `أضف ${nameOf(u)} إلى التقويم` : `Add ${nameOf(u)} to calendar`}>
                          <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                          {ar ? 'للتقويم' : 'Calendar'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <p className="text-xs text-[var(--ink-3)] leading-relaxed">
          {ar
            ? 'التواريخ الدينية تُحسب بالتقويم الهجري (أم القرى) وقد تختلف يوماً بحسب رؤية الهلال في كل بلد. الأعياد الوطنية قد تُنقل أو يُعلَن عن عطلتها سنوياً؛ تُؤكَّد دائماً مع الجهة المضيفة.'
            : 'Religious dates use the Hijri (Umm al-Qura) calendar and can differ by a day with local moon sighting. National holidays may be moved or announced each year; always confirm with the host.'}
        </p>
      </div>

      <Dialog open={Boolean(draftFor)} onClose={() => setDraftFor(null)} title={draftFor ? `${nameOf(draftFor)} · ${countryOf(draftFor)}` : ''} subtitle={ar ? 'مسودة تهنئة قابلة للتعديل' : 'An editable greeting draft'}>
        <div className="space-y-3">
          <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={10} aria-label={ar ? 'نص التهنئة' : 'Greeting text'} className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3 text-sm leading-relaxed" data-testid="draft-text" />
          <p className="text-xs text-[var(--ink-3)]">{ar ? 'املأ الاسم واللقب الدقيق من دليل المراسم قبل الإرسال.' : 'Fill in the exact name and title from the protocol guide before sending.'}</p>
          <button
            type="button"
            className={btn}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(draftText);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
            {copied ? (ar ? 'تم النسخ' : 'Copied') : ar ? 'انسخ النص' : 'Copy text'}
          </button>
        </div>
      </Dialog>
    </AppShell>
  );
}
