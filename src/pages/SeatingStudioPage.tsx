import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileSpreadsheet, ImageDown, Play, Plus, Printer, ShieldCheck, Sparkles, Trash2, TriangleAlert, Wand2, X } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { downloadBlob, downloadPng } from '../components/visuals/export.ts';
import { NameCardPage, CARDS_PER_PAGE, type CardPerson } from '../components/visuals/NameCards';
import { SeatingFloorplan, LAYOUT_NAMES, type FloorSeat } from '../components/visuals/SeatingFloorplan';
import { tr } from '../components/visuals/svg-kit.tsx';
import { Hall3D, type Hall3DHandle } from '../components/three/Hall3D';
import { GuestsEnter } from '../components/visuals/GuestsEnter';
import type { CameraPreset, HallSeat } from '../components/three/hall-scene.ts';
import { useI18n } from '../lib/i18n';
import { MAX_GUESTS, parseGuestFile, parseGuestText } from '../shared/visuals/guest-import.ts';
import { findViolations, sortByPrecedence, swap, titleTier, type Guest } from '../shared/visuals/precedence.ts';
import { MAX_SEATS, planLayout, toPercent, type LayoutKind } from '../shared/visuals/seating.ts';

const KEY = 'wijaha.seating.v1';

interface Saved {
  guests: Guest[];
  hostName: string;
  hostTitle: string;
  layout: LayoutKind;
  order: string[];
  auto: boolean;
}

const SAMPLE_AR: Guest[] = [
  { id: 'g1', name: 'ضيف ١', title: 'مدير إدارة' },
  { id: 'g2', name: 'ضيف ٢', title: 'مستشار' },
  { id: 'g3', name: 'ضيف ٣', title: 'سفير' },
  { id: 'g4', name: 'ضيف ٤', title: 'وزير الصناعة' },
  { id: 'g5', name: 'ضيف ٥', title: 'رئيس جامعة' },
  { id: 'g6', name: 'ضيف ٦', title: 'الرئيس التنفيذي' },
  { id: 'g7', name: 'ضيف ٧', title: 'وكيل وزارة' },
];
const SAMPLE_EN: Guest[] = [
  { id: 'g1', name: 'Guest 1', title: 'Department Manager' },
  { id: 'g2', name: 'Guest 2', title: 'Advisor' },
  { id: 'g3', name: 'Guest 3', title: 'Ambassador' },
  { id: 'g4', name: 'Guest 4', title: 'Minister of Industry' },
  { id: 'g5', name: 'Guest 5', title: 'University President' },
  { id: 'g6', name: 'Guest 6', title: 'Chief Executive Officer' },
  { id: 'g7', name: 'Guest 7', title: 'Undersecretary' },
];

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    return Array.isArray(v.guests) && v.layout ? v : null;
  } catch {
    return null;
  }
}

const field = 'w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]';
const card = 'rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5';
const chip = (active: boolean) =>
  `min-h-[40px] rounded-full border px-4 text-sm font-semibold cursor-pointer transition-colors ${
    active ? 'bg-[var(--primary)] text-[var(--bg)] border-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--ink-2)] border-[var(--line)] hover:text-[var(--ink)]'
  }`;

export function SeatingStudioPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const saved = useMemo(load, []);
  const [guests, setGuests] = useState<Guest[]>(saved?.guests ?? (ar ? SAMPLE_AR : SAMPLE_EN));
  const [hostName, setHostName] = useState(saved?.hostName ?? (ar ? 'المضيف' : 'Host'));
  const [hostTitle, setHostTitle] = useState(saved?.hostTitle ?? '');
  const [layout, setLayout] = useState<LayoutKind>(saved?.layout ?? 'majlis');
  const [order, setOrder] = useState<string[]>(saved?.order ?? []);
  const [auto, setAuto] = useState(saved?.auto ?? true);
  const [pasteText, setPasteText] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string>('');
  const [playKey, setPlayKey] = useState(0);
  const planRef = useRef<SVGSVGElement>(null);
  const hallRef = useRef<Hall3DHandle>(null);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [preset, setPreset] = useState<CameraPreset>('overview');
  const [presetNonce, setPresetNonce] = useState(0);
  const [no3d, setNo3d] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pageRefs = useRef<Array<SVGSVGElement | null>>([]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ guests, hostName, hostTitle, layout, order, auto } satisfies Saved));
    } catch {
      /* private mode: the studio still works, it just does not remember */
    }
  }, [guests, hostName, hostTitle, layout, order, auto]);

  const maxGuests = MAX_SEATS[layout] - 1;

  // The order shown: suggested by precedence, or the user's own after a manual change.
  const ordered = useMemo(() => {
    if (auto) return sortByPrecedence(guests);
    const byId = new Map(guests.map((g) => [g.id, g]));
    const kept = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    const rest = guests.filter((g) => !order.includes(g.id));
    return [...kept, ...rest];
  }, [auto, guests, order]);
  const shown = ordered.slice(0, maxGuests);
  const hidden = ordered.length - shown.length;

  const people: Array<Guest & { rank: number }> = useMemo(
    () => [{ id: 'host', name: hostName.trim() || (ar ? 'المضيف' : 'Host'), title: hostTitle.trim(), rank: 1 }, ...shown.map((g, i) => ({ ...g, rank: i + 2 }))],
    [hostName, hostTitle, shown, ar],
  );

  const plan = useMemo(() => planLayout(layout, people.length), [layout, people.length]);
  const floorSeats: FloorSeat[] = useMemo(
    () =>
      plan.seats.map((spot) => {
        const person = people[spot.rank - 1] ?? people[0];
        const pc = toPercent(spot.x, spot.y);
        return { id: person.id, label: person.name, role: person.title || undefined, rank: spot.rank, x: pc.x, y: pc.y };
      }),
    [plan, people],
  );

  const hallSeats: HallSeat[] = useMemo(
    () =>
      plan.seats.map((spot) => {
        const person = people[spot.rank - 1] ?? people[0];
        return { id: person.id, label: person.name, role: person.title || undefined, rank: spot.rank, x: spot.x, y: spot.y, facing: spot.facing };
      }),
    [plan, people],
  );
  const violations = useMemo(() => findViolations(shown), [shown]);
  const warnIds = violations.map((v) => v.lower);
  const nameOf = (id: string) => guests.find((g) => g.id === id);

  const commitOrder = (next: Guest[]) => {
    setOrder(next.map((g) => g.id));
    setAuto(false);
  };
  const doSwap = (aId: string, bId: string) => {
    if (aId === 'host' || bId === 'host') {
      setStatus(tr(locale, 'مقعد المضيف ثابت في الموضع الأول.', "The host's seat is fixed in the first position."));
      return;
    }
    const ia = shown.findIndex((g) => g.id === aId);
    const ib = shown.findIndex((g) => g.id === bId);
    if (ia < 0 || ib < 0) return;
    commitOrder([...swap(shown, ia, ib), ...ordered.slice(maxGuests)]);
    setStatus('');
  };
  const move = (id: string, delta: -1 | 1) => {
    const i = shown.findIndex((g) => g.id === id);
    if (i < 0) return;
    commitOrder([...swap(shown, i, i + delta), ...ordered.slice(maxGuests)]);
  };

  const importList = (res: { guests: Guest[]; skipped: number }) => {
    if (res.guests.length === 0) {
      setStatus(tr(locale, 'لم أجد أسماء في هذا المحتوى.', 'No names were found in that content.'));
      return;
    }
    setGuests(res.guests);
    setAuto(true);
    setOrder([]);
    setSelected('');
    setPlayKey((n) => n + 1);
    setStatus(
      tr(locale, `تم استيراد ${res.guests.length} ضيفاً${res.skipped ? ` وتخطّي ${res.skipped}` : ''}.`, `Imported ${res.guests.length} guests${res.skipped ? `, skipped ${res.skipped}` : ''}.`),
    );
  };

  const updateGuest = (id: string, patch: Partial<Guest>) => setGuests((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const addGuest = () => {
    if (guests.length >= MAX_GUESTS) return;
    const id = `g${Date.now().toString(36)}`;
    setGuests((gs) => [...gs, { id, name: '', title: '' }]);
  };

  const cardPeople: CardPerson[] = people.map((p) => ({ rank: p.rank, name: p.name, title: p.title }));
  const pages = Math.max(1, Math.ceil(cardPeople.length / CARDS_PER_PAGE));

  const downloadCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [[ar ? 'الترتيب' : 'Rank', ar ? 'الاسم' : 'Name', ar ? 'المنصب' : 'Title'], ...people.map((p) => [String(p.rank), p.name, p.title])];
    downloadBlob(new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'wijaha-seating-order.csv');
  };

  const btn = 'min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors disabled:opacity-50';

  return (
    <AppShell>
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <header className="v2-hero !rounded-[28px] px-6 sm:px-10 py-8 sm:py-11 space-y-3">
          <span className="inline-flex items-center gap-2 text-[0.72rem] tracking-[0.35em] text-[var(--gold)] uppercase">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            {ar ? 'مولّد الجلوس' : 'Seating studio'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-[1.2] text-[var(--primary-fg)]">
            {ar ? 'من قائمة الضيوف إلى مخطط جلوس جاهز للطباعة' : 'From a guest list to a print-ready seating plan'}
          </h1>
          <p className="max-w-3xl text-[var(--primary-fg)]/80 leading-relaxed sm:text-lg">
            {ar
              ? 'الصق القائمة من Excel أو ارفع الملف، فيُرتَّب الضيوف مقترحاً بحسب المنصب، ثم اسحبهم بين المقاعد، وحمّل المخطط وبطاقات الأسماء.'
              : 'Paste the list from Excel or upload the file. Guests are ordered by title as a suggestion; drag them between seats, then download the plan and name cards.'}
          </p>
          <p className="inline-flex items-center gap-2 text-xs text-[var(--primary-fg)]/75">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            {ar ? 'القائمة تبقى في متصفحك ولا تُرسَل إلى أي خادم.' : 'The list stays in your browser and is never sent to a server.'}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] items-start">
          {/* ---------------- inputs */}
          <div className="space-y-6">
            <section className={card} aria-labelledby="guests-h">
              <h2 id="guests-h" className="text-lg font-bold text-[var(--ink)]">{ar ? '١. الضيوف' : '1. Guests'}</h2>
              <p className="text-xs text-[var(--ink-3)] mt-1 leading-relaxed">
                {ar ? 'عمودان: الاسم ثم المنصب. يقبل Excel وCSV أو لصقاً مباشراً.' : 'Two columns: name then title. Accepts Excel, CSV or a direct paste.'}
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={4}
                placeholder={ar ? 'الضيف الأول\tوزير\nالضيف الثاني\tسفير' : 'First guest\tMinister\nSecond guest\tAmbassador'}
                aria-label={ar ? 'الصق قائمة الضيوف' : 'Paste the guest list'}
                className="mt-3 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm leading-relaxed"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => importList(parseGuestText(pasteText))} disabled={!pasteText.trim()} data-testid="import-paste">
                  {ar ? 'استيراد من النص' : 'Import text'}
                </button>
                <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
                  <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                  {ar ? 'رفع ملف' : 'Upload file'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv,.tsv,.txt"
                  className="sr-only"
                  data-testid="guest-file"
                  aria-label={ar ? 'ملف الضيوف' : 'Guest file'}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    try {
                      importList(await parseGuestFile(f));
                    } catch {
                      setStatus(tr(locale, 'تعذّرت قراءة الملف. جرّب CSV أو الصق النص.', 'The file could not be read. Try CSV or paste the text.'));
                    }
                  }}
                />
                <button type="button" className={btn} onClick={() => importList({ guests: ar ? SAMPLE_AR : SAMPLE_EN, skipped: 0 })}>
                  {ar ? 'مثال' : 'Example'}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--ink-2)] min-h-[1.25rem]" role="status" aria-live="polite" data-testid="studio-status">{status}</p>

              <ul className="mt-3 space-y-2" aria-label={ar ? 'قائمة الضيوف' : 'Guest list'}>
                {guests.map((g, i) => (
                  <li key={g.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <input className={field} value={g.name} onChange={(e) => updateGuest(g.id, { name: e.target.value.slice(0, 60) })} placeholder={ar ? `الاسم ${i + 1}` : `Name ${i + 1}`} aria-label={ar ? `اسم الضيف ${i + 1}` : `Guest ${i + 1} name`} />
                    <input className={field} value={g.title} onChange={(e) => updateGuest(g.id, { title: e.target.value.slice(0, 80) })} placeholder={ar ? 'المنصب' : 'Title'} aria-label={ar ? `منصب الضيف ${i + 1}` : `Guest ${i + 1} title`} />
                    <button type="button" onClick={() => setGuests((gs) => gs.filter((x) => x.id !== g.id))} className="w-11 h-11 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer" aria-label={ar ? `احذف الضيف ${i + 1}` : `Remove guest ${i + 1}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={addGuest} disabled={guests.length >= MAX_GUESTS}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  {ar ? 'أضف ضيفاً' : 'Add guest'}
                </button>
                <button type="button" className={btn} onClick={() => { setGuests([]); setOrder([]); setAuto(true); }} disabled={guests.length === 0}>
                  <X className="w-4 h-4" aria-hidden="true" />
                  {ar ? 'مسح الكل' : 'Clear all'}
                </button>
              </div>
            </section>

            <section className={card} aria-labelledby="room-h">
              <h2 id="room-h" className="text-lg font-bold text-[var(--ink)]">{ar ? '٢. المضيف والقاعة' : '2. Host and room'}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input className={field} value={hostName} onChange={(e) => setHostName(e.target.value.slice(0, 60))} placeholder={ar ? 'اسم المضيف' : 'Host name'} aria-label={ar ? 'اسم المضيف' : 'Host name'} />
                <input className={field} value={hostTitle} onChange={(e) => setHostTitle(e.target.value.slice(0, 80))} placeholder={ar ? 'منصب المضيف' : 'Host title'} aria-label={ar ? 'منصب المضيف' : 'Host title'} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label={ar ? 'نوع القاعة' : 'Room type'}>
                {(Object.keys(LAYOUT_NAMES) as LayoutKind[]).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={layout === k} className={chip(layout === k)} onClick={() => { setLayout(k); setPlayKey((n) => n + 1); }}>
                    {tr(locale, LAYOUT_NAMES[k].ar, LAYOUT_NAMES[k].en)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--ink-3)]">
                {ar ? `هذه القاعة تتسع لـ ${MAX_SEATS[layout]} مقعداً (المضيف + ${maxGuests} ضيفاً).` : `This room seats ${MAX_SEATS[layout]} (host + ${maxGuests} guests).`}
              </p>
              {hidden > 0 && (
                <p className="mt-2 text-xs text-[#9a5a00] flex items-start gap-1.5" role="alert">
                  <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {ar ? `لم يتّسع المخطط لـ ${hidden} من الضيوف الأخيرين في الترتيب.` : `${hidden} guest(s) at the end of the order do not fit in this room.`}
                </p>
              )}
            </section>
          </div>

          {/* ---------------- plan */}
          <div className="space-y-6 lg:sticky lg:top-20">
            <section className={card} aria-labelledby="plan-h">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 id="plan-h" className="text-lg font-bold text-[var(--ink)]">{ar ? '٣. المخطط' : '3. The plan'}</h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btn} onClick={() => setPlayKey((n) => n + 1)} data-testid="studio-play">
                    <Play className="w-4 h-4" aria-hidden="true" />
                    {ar ? 'شغّل' : 'Play'}
                  </button>
                  <button type="button" className={btn} onClick={() => { setAuto(true); setOrder([]); setStatus(tr(locale, 'أُعيد الترتيب المقترح بحسب المنصب.', 'Suggested order by title restored.')); }} disabled={auto} data-testid="studio-auto">
                    <Wand2 className="w-4 h-4" aria-hidden="true" />
                    {ar ? 'الترتيب المقترح' : 'Suggested order'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--ink-3)] mb-3 leading-relaxed">
                {ar ? 'اسحب أي ضيف وأفلته على مقعد آخر للتبديل. ترتيب الأسبقية الرسمي تحدده الجهة المضيفة؛ هذا ترتيب مقترح من المناصب.' : "Drag any guest onto another seat to swap. The official order of precedence is set by the host; this is a suggestion from titles."}
              </p>
              <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label={ar ? 'نمط العرض' : 'View mode'}>
                <button type="button" aria-pressed={view === '2d'} className={btn} onClick={() => setView('2d')} data-testid="view-2d">{ar ? 'مخطط ثنائي' : '2D plan'}</button>
                <button type="button" aria-pressed={view === '3d'} className={btn} onClick={() => setView('3d')} data-testid="view-3d">{ar ? 'قاعة ثلاثية الأبعاد' : '3D hall'}</button>
                {view === '3d' && !no3d && (
                  <>
                    {([['overview', ar ? 'نظرة عامة' : 'Overview'], ['chief', ar ? 'من مقعد الضيف الرئيسي' : 'Chief guest’s view'], ['host', ar ? 'من مقعد المضيف' : 'Host’s view'], ['door', ar ? 'من الباب' : 'From the door']] as Array<[CameraPreset, string]>).map(([k, label]) => (
                      <button key={k} type="button" aria-pressed={preset === k} className={btn} onClick={() => { setPreset(k); setPresetNonce((n) => n + 1); }} data-testid={`cam-${k}`}>{label}</button>
                    ))}
                    <button type="button" className={btn} onClick={() => void hallRef.current?.snapshot().then((b) => downloadBlob(b, 'wijaha-hall-3d.png'))} data-testid="hall-png">
                      <ImageDown className="w-4 h-4" aria-hidden="true" />
                      {ar ? 'لقطة PNG' : 'PNG snapshot'}
                    </button>
                  </>
                )}
              </div>
              {view === '3d' ? (
                no3d ? (
                  <p role="alert" className="rounded-2xl border border-[var(--c-rose)] p-4 text-[var(--ink)]" data-testid="hall-fallback">{ar ? 'جهازك لا يدعم العرض ثلاثي الأبعاد؛ استخدم المخطط الثنائي.' : 'Your device does not support 3D; use the 2D plan.'}</p>
                ) : (
                  <>
                    <Hall3D ref={hallRef} plan={plan} seats={hallSeats} selectedId={selected} warnIds={warnIds} rtl={ar} preset={preset} presetNonce={presetNonce} onPick={(id) => setSelected(id)} onUnsupported={() => setNo3d(true)} ariaLabel={ar ? 'قاعة ثلاثية الأبعاد تدور بإصبعك' : 'Rotatable 3D hall'} />
                    <GuestsEnter hall={hallRef} ar={ar} className="mt-2" />
                    <p className="mt-2 text-xs text-[var(--ink-3)]">{ar ? 'اسحب للتدوير، وقرّب بالقرص، وانقر ضيفاً لتحديده. تبديل المقاعد يتم من المخطط الثنائي.' : 'Drag to rotate, pinch to zoom, tap a guest to select. Swap seats in the 2D plan.'}</p>
                  </>
                )
              ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-2 sm:p-3 overflow-hidden">
                <SeatingFloorplan ref={planRef} layout={layout} seats={floorSeats} locale={locale} selectedId={selected} onSelect={setSelected} animateKey={playKey} onSwap={doSwap} showNames warnIds={warnIds} ariaLabel={ar ? 'مخطط الجلوس القابل للسحب' : 'Draggable seating plan'} />
              </div>
              )}

              {violations.length > 0 && (
                <div className="mt-3 rounded-2xl border border-[#d97706]/50 bg-[#fff6e5] text-[#5a3200] p-3.5 space-y-2" role="alert" data-testid="studio-warnings">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <TriangleAlert className="w-4 h-4" aria-hidden="true" />
                    {ar ? 'تنبيهات الأسبقية' : 'Precedence warnings'}
                  </p>
                  <ul className="space-y-1.5">
                    {violations.map((v) => {
                      const hi = nameOf(v.higher);
                      const lo = nameOf(v.lower);
                      if (!hi || !lo) return null;
                      return (
                        <li key={`${v.higher}-${v.lower}`} className="text-xs leading-relaxed flex flex-wrap items-center gap-2">
                          <span>
                            {ar
                              ? `${lo.name} (${lo.title || 'بلا منصب'}) يجلس قبل ${hi.name} (${hi.title}) الأعلى مقاماً.`
                              : `${lo.name} (${lo.title || 'no title'}) sits before ${hi.name} (${hi.title}), who ranks higher.`}
                          </span>
                          <button type="button" onClick={() => doSwap(v.higher, v.lower)} className="rounded-full border border-[#d97706]/60 px-2.5 py-1 font-semibold hover:bg-[#ffe9c2] cursor-pointer">
                            {ar ? 'بدّلهما' : 'Swap them'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <ol className="mt-4 space-y-2" aria-label={ar ? 'ترتيب الجلوس' : 'Seating order'}>
                {people.map((p, i) => (
                  <li key={p.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${selected === p.id ? 'border-[var(--gold)] bg-[var(--surface-2)]' : 'border-[var(--line)] bg-[var(--bg)]'}`}>
                    <button type="button" onClick={() => setSelected(p.id)} className="flex items-center gap-3 flex-1 min-w-0 text-start cursor-pointer min-h-[44px]">
                      <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold tabular-nums ${p.rank === 1 ? 'bg-[#0f1b33] text-[#f6e7c1]' : p.rank === 2 ? 'bg-[#cfae6a] text-[#14213d]' : 'bg-[var(--surface)] border border-[var(--ink-3)] text-[var(--ink)]'}`}>{p.rank}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--ink)] truncate">{p.name}</span>
                        <span className="block text-xs text-[var(--ink-3)] truncate">{p.title || (ar ? 'بلا منصب' : 'No title')}{p.id !== 'host' && ` · ${ar ? 'الفئة' : 'tier'} ${titleTier(p.title)}`}</span>
                      </span>
                    </button>
                    {p.id !== 'host' && (
                      <span className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => move(p.id, -1)} disabled={i <= 1} className="w-10 h-10 rounded-lg border border-[var(--line)] flex items-center justify-center disabled:opacity-30 cursor-pointer" aria-label={ar ? `قدّم ${p.name}` : `Move ${p.name} earlier`}>
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => move(p.id, 1)} disabled={i >= people.length - 1} className="w-10 h-10 rounded-lg border border-[var(--line)] flex items-center justify-center disabled:opacity-30 cursor-pointer" aria-label={ar ? `أخّر ${p.name}` : `Move ${p.name} later`}>
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => planRef.current && void downloadPng(planRef.current, 'wijaha-seating-plan')} data-testid="studio-png">
                  <ImageDown className="w-4 h-4" aria-hidden="true" />
                  {ar ? 'حمّل المخطط PNG' : 'Download plan PNG'}
                </button>
                <button type="button" className={btn} onClick={downloadCsv} data-testid="studio-csv">
                  <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                  {ar ? 'الترتيب CSV' : 'Order CSV'}
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* ---------------- name cards */}
        <section className={card} aria-labelledby="cards-h">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 id="cards-h" className="text-lg font-bold text-[var(--ink)]">{ar ? '٤. بطاقات الأسماء' : '4. Name cards'}</h2>
              <p className="text-xs text-[var(--ink-3)] mt-1 leading-relaxed max-w-2xl">
                {ar ? 'ثمان بطاقات في كل صفحة A4، تُطوى من المنتصف فيُقرأ الاسم من الجهتين. تُقص على الخط المتقطع.' : 'Eight cards per A4 page, folded in the middle so the name reads from both sides. Cut along the dashed line.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} type="button" className={btn} onClick={() => pageRefs.current[i] && void downloadPng(pageRefs.current[i]!, `wijaha-name-cards-${i + 1}`, 2)} data-testid="cards-png">
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  {ar ? `صفحة ${i + 1} PNG` : `Page ${i + 1} PNG`}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: pages }, (_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-[var(--line)] shadow-sm">
                <NameCardPage ref={(el) => { pageRefs.current[i] = el; }} people={cardPeople.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE)} locale={locale} page={i + 1} pages={pages} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
