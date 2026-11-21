import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, Circle, ClipboardList, Copy } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { downloadBlob } from '../../components/visuals/export.ts';
import { tr } from '../../components/visuals/svg-kit.tsx';
import { useI18n } from '../../lib/i18n';
import { COUNTRY_NAMES, fallsOnWeekend } from '../../shared/occasions.ts';
import { buildInvitation, clashesFor, EMPTY_EVENT, eventIcs, readiness, type EventFile } from '../../shared/tools/event.ts';
import { TEMPLATES } from '../../shared/tools/live.ts';
import { btn, btnPrimary, card, input, Page, ToolHero } from './ui';

const KEY = 'wijaha.event.v1';
const GULF = ['KW', 'SA', 'AE', 'QA', 'BH', 'OM'];

function load(): EventFile {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<EventFile> | null;
    return { ...EMPTY_EVENT, ...(v ?? {}) };
  } catch {
    return EMPTY_EVENT;
  }
}
function readPartners(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem('wijaha.partners.v1') ?? 'null') as string[] | null;
    return Array.isArray(v) && v.length ? v : GULF;
  } catch {
    return GULF;
  }
}
function readGuests(): number {
  try {
    const v = JSON.parse(localStorage.getItem('wijaha.seating.v1') ?? 'null') as { guests?: unknown[] } | null;
    return Array.isArray(v?.guests) ? v!.guests!.length : 0;
  } catch {
    return 0;
  }
}

export function EventPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const lang = ar ? 'ar' : 'en';
  const [ev, setEv] = useState<EventFile>(load);
  const [copied, setCopied] = useState(false);
  const partners = useMemo(readPartners, []);
  const guests = useMemo(readGuests, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ev));
    } catch {
      /* not remembered */
    }
  }, [ev]);

  const set = (k: keyof EventFile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEv((x) => ({ ...x, [k]: e.target.value }));
  const clashes = useMemo(() => clashesFor(ev, partners), [ev, partners]);
  const items = useMemo(() => readiness(ev, { guests, clashes }), [ev, guests, clashes]);
  const done = items.filter((i) => i.ok).length;
  const text = useMemo(() => buildInvitation(ev, lang), [ev, lang]);
  const ics = useMemo(() => eventIcs(ev, lang), [ev, lang]);
  const liveLink = `/live?t=${encodeURIComponent(ev.templateId)}${ev.start ? `&s=${encodeURIComponent(ev.start)}` : ''}`;

  const Field = ({ k, label, type = 'text', ph }: { k: keyof EventFile; label: string; type?: string; ph?: string }) => (
    <label className="block text-sm font-semibold text-[var(--ink)]">
      {label}
      <input className={`${input} mt-1`} type={type} value={ev[k]} onChange={set(k)} placeholder={ph} data-testid={`ev-${k}`} />
    </label>
  );

  return (
    <AppShell>
      <Page>
        <ToolHero
          icon={<ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />}
          kicker={ar ? 'ملف الفعالية' : 'Event file'}
          title={ar ? 'أدخل فعاليتك مرة واحدة' : 'Enter your event once'}
          sub={ar ? 'من بياناتك تتولّد الدعوة وملف التقويم وجدول يوم الفعالية، ويفحص ملفك التعارض مع أيام شركائك الوطنية والدينية وجاهزية التجهيز.' : 'From your details come the invitation, the calendar file and the event-day run sheet, plus a check for clashes with partners’ national and religious days and a readiness list.'}
        />

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <section className={`${card} grid gap-4 sm:grid-cols-2`} aria-label={ar ? 'بيانات الفعالية' : 'Event details'}>
            <div className="sm:col-span-2"><Field k="name" label={ar ? 'اسم الفعالية' : 'Event name'} ph={ar ? 'حفل استقبال وفد…' : 'Reception for the delegation…'} /></div>
            <label className="block text-sm font-semibold text-[var(--ink)]">
              {ar ? 'النوع' : 'Type'}
              <select className={`${input} mt-1`} value={ev.templateId} onChange={set('templateId')} data-testid="ev-templateId">
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{tr(locale, t.ar, t.en)}</option>)}
              </select>
            </label>
            <Field k="start" type="datetime-local" label={ar ? 'التاريخ والوقت' : 'Date and time'} />
            <div className="sm:col-span-2"><Field k="venue" label={ar ? 'المكان' : 'Venue'} /></div>
            <Field k="hostTitle" label={ar ? 'لقب المضيف' : 'Host title'} ph={ar ? 'سعادة' : 'H.E.'} />
            <Field k="hostName" label={ar ? 'اسم المضيف' : 'Host name'} />
            <Field k="dress" label={ar ? 'الزي' : 'Dress code'} />
            <Field k="rsvp" label={ar ? 'تأكيد الحضور (بريد/رقم)' : 'RSVP (email/phone)'} />
            <p className="sm:col-span-2 text-sm text-[var(--ink-2)]">{ar ? 'تُحفظ بياناتك في متصفحك فقط.' : 'Your details are stored only in your browser.'}</p>
          </section>

          <div className="space-y-6">
            <section className={`${card} space-y-3`} aria-labelledby="ready-h">
              <h2 id="ready-h" className="text-xl font-bold text-[var(--ink)]">{ar ? `الجاهزية: ${done} من ${items.length}` : `Readiness: ${done} of ${items.length}`}</h2>
              <ul className="space-y-1.5" data-testid="ev-ready">
                {items.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 text-[var(--ink)]" data-ok={i.ok}>
                    {i.ok ? <CheckCircle2 className="w-5 h-5 text-[var(--c-teal)] shrink-0" aria-label={ar ? 'تم' : 'Done'} /> : <Circle className="w-5 h-5 text-[var(--ink-3)] shrink-0" aria-label={ar ? 'لم يتم' : 'Not done'} />}
                    <span>{tr(locale, i.ar, i.en)}</span>
                  </li>
                ))}
              </ul>
              {clashes.length > 0 && (
                <div role="alert" className="rounded-2xl border border-[var(--c-rose)] p-3 space-y-1" data-testid="ev-clash">
                  <p className="font-bold text-[var(--c-rose)]">{ar ? 'تنبيه: تاريخك يصادف:' : 'Warning: your date falls on:'}</p>
                  {clashes.map((c) => (
                    <p key={c.def.id + (c.country ?? '')} className="text-[var(--ink)]">
                      {tr(locale, c.def.nameAr, c.def.nameEn)} — {c.country ? tr(locale, COUNTRY_NAMES[c.country].ar, COUNTRY_NAMES[c.country].en) : tr(locale, 'كل الدول', 'All countries')}
                      {c.approx ? (ar ? ' (تقريبي)' : ' (approx.)') : ''}
                    </p>
                  ))}
                </div>
              )}
              {clashes.length === 0 && ev.start && partners.some((p) => fallsOnWeekend(p, new Date(ev.start.slice(0, 10) + 'T00:00:00Z'))) && (
                <p className="text-sm text-[var(--c-gold)]" data-testid="ev-weekend">{ar ? 'تنبيه: التاريخ يصادف عطلة أسبوعية عند أحد شركائك.' : 'Note: the date falls on a weekend for one of your partners.'}</p>
              )}
            </section>

            <section className={`${card} space-y-3`} aria-labelledby="inv-h">
              <h2 id="inv-h" className="text-xl font-bold text-[var(--ink)]">{ar ? 'نص الدعوة' : 'Invitation text'}</h2>
              <pre className="whitespace-pre-wrap rounded-2xl bg-[var(--surface-2)] p-4 text-[var(--ink)] leading-8 font-[inherit]" data-testid="ev-invitation">{text}</pre>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true)); }} data-testid="ev-copy">
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  {copied ? (ar ? 'نُسخ' : 'Copied') : ar ? 'انسخ النص' : 'Copy text'}
                </button>
                <button type="button" className={btn} disabled={!ics} onClick={() => ics && downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'wijaha-event.ics')} data-testid="ev-ics">
                  <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                  {ar ? 'ملف التقويم .ics' : 'Calendar .ics'}
                </button>
              </div>
              <p className="text-sm text-[var(--ink-2)]">{ar ? 'التاريخ الهجري تقريبي؛ تحقق منه قبل الطباعة.' : 'The Hijri date is approximate; verify it before printing.'}</p>
            </section>

            <section className={`${card} space-y-3`} aria-labelledby="next-h">
              <h2 id="next-h" className="text-xl font-bold text-[var(--ink)]">{ar ? 'الخطوة التالية' : 'Next steps'}</h2>
              <div className="flex flex-wrap gap-2">
                <Link to={liveLink} className={btnPrimary} data-testid="ev-live">{ar ? 'افتح جدول اليوم الحي' : 'Open the live run sheet'}</Link>
                <Link to="/seating" className={btn}>{ar ? `مولّد الجلوس (${guests} ضيف)` : `Seating studio (${guests} guests)`}</Link>
                <Link to="/occasions" className={btn}>{ar ? 'رادار المناسبات' : 'Occasions radar'}</Link>
                <Link to="/photo-check" className={btn}>{ar ? 'افحص الدعوة المطبوعة' : 'Check the printed invitation'}</Link>
              </div>
            </section>
          </div>
        </div>
      </Page>
    </AppShell>
  );
}
