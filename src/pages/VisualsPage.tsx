import React, { useMemo, useRef, useState } from 'react';
import { Armchair, Camera, Download, Flag, GalleryVerticalEnd, ImageDown, Minus, Play, Plus, Route, Share2, Sparkles, Utensils } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { downloadPng, downloadSvg, shareOrDownloadPng } from '../components/visuals/export.ts';
import { PlaceSetting } from '../components/visuals/PlaceSetting';
import { PodiumFlags, SCENE_NAMES, type PodiumScene } from '../components/visuals/PodiumFlags';
import { ReceptionPath, type PathVariant } from '../components/visuals/ReceptionPath';
import { RuleDialog } from '../components/visuals/RuleDialog';
import { SeatingFloorplan, SeatLegend, LAYOUT_NAMES } from '../components/visuals/SeatingFloorplan';
import { ACCENTS, ShareCard, type CardAccent } from '../components/visuals/ShareCard';
import { tr } from '../components/visuals/svg-kit.tsx';
import { VisualTimeline, type VisualDay } from '../components/visuals/VisualTimeline';
import { useI18n } from '../lib/i18n';
import { buildSeatNodes } from '../shared/visuals/seat-nodes.ts';
import { MAX_SEATS, MIN_SEATS, type LayoutKind } from '../shared/visuals/seating.ts';

const LAYOUT_RULE: Record<LayoutKind, string> = {
  majlis: 'R-ARAB-023',
  round: 'R-DEMO-0011',
  rect: 'R-DEMO-0038',
  u_shape: 'R-ARAB-024',
  theatre: 'R-ARAB-024',
};

const LAYOUT_NOTE: Record<LayoutKind, { ar: string; en: string }> = {
  majlis: { ar: 'ضيف الشرف قرب صدر المجلس إلى يمين المضيف، ويتدرج الباقون على امتداد الجدارين بحسب المقام.', en: "The guest of honor sits near the head of the majlis on the host's right; the others follow along the two walls by rank." },
  round: { ar: 'المضيف يواجه المدخل، وضيف الشرف عن يمينه، ثم يتناوب الضيوف يميناً ويساراً بحسب الأسبقية.', en: 'The host faces the entrance with the chief guest on his right; guests then alternate right and left by precedence.' },
  rect: { ar: 'الرئيسان وجهاً لوجه في منتصف الضلعين الطويلين، والوفدان يتدرجان بالتناوب إلى الجانبين.', en: 'The two principals face each other at the centres of the long sides; the delegations step out alternately.' },
  u_shape: { ar: 'رأس الطاولة للمضيف، وضيف الشرف عن يمينه، ويتدرج الجلوس على الذراعين بالتناوب.', en: "The host takes the head of the table with the chief guest on his right; seating steps down the two arms alternately." },
  theatre: { ar: 'الصف الأول للأعلى مقاماً من منتصفه إلى الخارج، وضيف الشرف إلى جهة يمين المضيف.', en: "The front row is for the most senior, from the centre outward, with the guest of honor on the host's side." },
};

const SAMPLE_PROGRAM_AR: VisualDay[] = [
  {
    label: 'اليوم الأول: الزيارة الرسمية',
    items: [
      { time: '09:30', title: 'وصول الوفد إلى المطار', detail: 'استقبال منسّق المراسم بقائمة الأسماء كاملة وألقابها.', location: 'صالة كبار الزوار', ruleId: 'R-ARAB-017' },
      { time: '10:15', title: 'الانتقال بالمواكب إلى مقر الاجتماع', detail: 'السيارات بحسب الأسبقية ومرافق مع كل سيارة.', ruleId: 'R-ARAB-032' },
      { time: '11:00', title: 'القهوة والتمر والترحيب', detail: 'ضيافة عربية عند الوصول قبل الاجتماع.', ruleId: 'R-ARAB-005' },
      { time: '11:30', title: 'اجتماع المباحثات', detail: 'جلوس بحسب الأسبقية، المضيف أمام المدخل.', location: 'قاعة الاجتماعات', ruleId: 'R-ARAB-024' },
      { time: '13:00', title: 'صلاة الظهر واستراحة', detail: 'مصلّى مهيأ واستراحة قصيرة.', ruleId: 'R-ARAB-007' },
      { time: '13:30', title: 'غداء رسمي', detail: 'مخطط الجلوس معتمد من مكتب المراسم والقيود الغذائية محسومة.', ruleId: 'R-ARAB-012' },
      { time: '15:30', title: 'تبادل الهدايا والصورة التذكارية', detail: 'هدية مؤسسية رمزية بتنسيق مسبق.', ruleId: 'R-ARAB-015' },
      { time: '16:15', title: 'مغادرة الوفد', detail: 'توديع عند الباب كما كان الاستقبال.' },
    ],
  },
];

const SAMPLE_PROGRAM_EN: VisualDay[] = [
  {
    label: 'Day 1: Official visit',
    items: [
      { time: '09:30', title: 'Delegation arrives at the airport', detail: 'Protocol coordinator receives them with the full name list and titles.', location: 'VIP lounge', ruleId: 'R-ARAB-017' },
      { time: '10:15', title: 'Motorcade transfer to the venue', detail: 'Cars ordered by precedence, with a liaison in each.', ruleId: 'R-ARAB-032' },
      { time: '11:00', title: 'Coffee, dates and welcome', detail: 'Arabic hospitality on arrival before the meeting.', ruleId: 'R-ARAB-005' },
      { time: '11:30', title: 'Bilateral talks', detail: 'Seating by precedence, the host facing the entrance.', location: 'Meeting room', ruleId: 'R-ARAB-024' },
      { time: '13:00', title: 'Noon prayer and rest', detail: 'A prepared prayer room and a short break.', ruleId: 'R-ARAB-007' },
      { time: '13:30', title: 'Official lunch', detail: 'Seating plan approved by the protocol office; dietary needs settled.', ruleId: 'R-ARAB-012' },
      { time: '15:30', title: 'Gift exchange and group photo', detail: 'A symbolic institutional gift, coordinated in advance.', ruleId: 'R-ARAB-015' },
      { time: '16:15', title: 'Delegation departs', detail: 'Seen off at the door as they were received.' },
    ],
  },
];

function ExportBar({ getSvg, name, locale, share = false, scale = 2 }: { getSvg: () => SVGSVGElement | null; name: string; locale: string; share?: boolean; scale?: number }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const run = async (fn: (svg: SVGSVGElement) => Promise<unknown> | unknown) => {
    const svg = getSvg();
    if (!svg) return;
    setBusy(true);
    setNote('');
    try {
      await fn(svg);
    } catch {
      setNote(tr(locale, 'تعذّر إنشاء الصورة في هذا المتصفح.', 'The image could not be created in this browser.'));
    } finally {
      setBusy(false);
    }
  };
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const btn = 'min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-50 cursor-pointer transition-colors';
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={tr(locale, 'تصدير', 'Export')}>
      <button type="button" className={btn} disabled={busy} onClick={() => run((s) => downloadPng(s, name, scale))} data-testid="export-png">
        <ImageDown className="w-4 h-4" aria-hidden="true" />
        {tr(locale, 'حمّل PNG', 'Download PNG')}
      </button>
      <button type="button" className={btn} disabled={busy} onClick={() => run((s) => downloadSvg(s, name))} data-testid="export-svg">
        <Download className="w-4 h-4" aria-hidden="true" />
        SVG
      </button>
      {share && canShare && (
        <button type="button" className={btn} disabled={busy} onClick={() => run((s) => shareOrDownloadPng(s, name, name, scale))}>
          <Share2 className="w-4 h-4" aria-hidden="true" />
          {tr(locale, 'مشاركة', 'Share')}
        </button>
      )}
      {note && <span className="text-xs text-[var(--ink-3)]">{note}</span>}
    </div>
  );
}

function Section({ id, icon: Icon, title, desc, children }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-11 h-11 rounded-2xl bg-[var(--t-gold)] text-[var(--c-gold)] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </span>
        <div>
          <h2 id={`${id}-h`} className="text-xl sm:text-2xl font-bold text-[var(--ink)]">{title}</h2>
          <p className="text-sm text-[var(--ink-2)] leading-relaxed mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-5">{children}</div>
    </section>
  );
}

const chip = (active: boolean) =>
  `min-h-[40px] rounded-full border px-4 text-sm font-semibold cursor-pointer transition-colors ${
    active ? 'bg-[var(--primary)] text-[var(--bg)] border-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--ink-2)] border-[var(--line)] hover:text-[var(--ink)]'
  }`;

export function VisualsPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [rule, setRule] = useState<string | null>(null);

  // 1. Seating
  const [layout, setLayout] = useState<LayoutKind>('majlis');
  const [count, setCount] = useState(8);
  const [selected, setSelected] = useState<string>('seat_2');
  const [playKey, setPlayKey] = useState(0);
  const seatRef = useRef<SVGSVGElement>(null);
  const seats = useMemo(() => buildSeatNodes(layout, count, ar ? 'ar' : 'en', layout === 'rect'), [layout, count, ar]);
  const max = MAX_SEATS[layout];

  // 2. Reception
  const [variant, setVariant] = useState<PathVariant>('majlis');
  const pathRef = useRef<SVGSVGElement>(null);
  const tableRef = useRef<SVGSVGElement>(null);

  // 4. Podium
  const [scene, setScene] = useState<PodiumScene>('signing');
  const podiumRef = useRef<SVGSVGElement>(null);

  // 5. Share card
  const [accent, setAccent] = useState<CardAccent>('gold');
  const [kicker, setKicker] = useState(ar ? 'قبل زيارة مجلس خليجي' : 'Before a Gulf majlis visit');
  const [title, setTitle] = useState(ar ? '٥ أشياء لا تنساها قبل زيارة مجلس' : '5 things to remember before a majlis visit');
  const [pointsText, setPointsText] = useState(
    ar
      ? 'سلّم على الجميع بدءاً بالأكبر مقاماً\nخذ فنجان القهوة بيدك اليمنى، وهزّه برفق للاكتفاء\nلا تُظهر باطن قدمك، ولا تجلس قبل أن يُشار إليك\nابدأ بالحديث العام وأجّل العمل بصبر\nمرور البخور إشارة إلى قرب انتهاء الجلسة'
      : 'Greet everyone, starting with the most senior\nTake the coffee cup with your right hand; shake it gently for enough\nNever show the soles of your feet; sit only where you are shown\nStart with general conversation and leave business for later\nIncense passing signals the visit is ending',
  );
  const cardRef = useRef<SVGSVGElement>(null);
  const points = pointsText.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5);

  const sections = [
    { id: 'seating', label: ar ? 'الجلوس' : 'Seating' },
    { id: 'reception', label: ar ? 'الاستقبال' : 'Reception' },
    { id: 'table', label: ar ? 'المائدة' : 'Table' },
    { id: 'podium', label: ar ? 'المنصة والأعلام' : 'Podium & flags' },
    { id: 'card', label: ar ? 'بطاقة المشاركة' : 'Share card' },
    { id: 'timeline', label: ar ? 'البرنامج' : 'Programme' },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        <header className="v2-hero !rounded-[28px] px-6 sm:px-10 py-9 sm:py-12 space-y-4">
          <span className="inline-flex items-center gap-2 text-[0.72rem] tracking-[0.35em] text-[var(--gold)] uppercase">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            {ar ? 'المكتبة المرئية' : 'Visual library'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-[1.2] text-[var(--primary-fg)]">
            {ar ? 'البروتوكول يُرى قبل أن يُقرأ' : 'Protocol you can see before you read it'}
          </h1>
          <p className="max-w-3xl text-[var(--primary-fg)]/80 leading-relaxed sm:text-lg">
            {ar
              ? 'مخططات جلوس ومسارات استقبال ومائدة رسمية ومنصات وبطاقات للمشاركة، تُرسم لحظياً في متصفحك، مجانية بالكامل، وقابلة للتحميل صورةً أو ملف SVG.'
              : 'Seating plans, reception paths, formal table settings, stages and shareable cards, drawn instantly in your browser: completely free and downloadable as an image or SVG.'}
          </p>
        </header>

        <nav aria-label={ar ? 'أقسام المكتبة' : 'Library sections'} className="sticky top-16 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-[var(--bg)]/90 backdrop-blur border-b border-[var(--line)] sm:border-0 sm:rounded-2xl">
          <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {sections.map((s) => (
              <li key={s.id} className="shrink-0">
                <a href={`#${s.id}`} className="inline-flex items-center min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink-2)] hover:text-[var(--ink)]">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 1. Seating ------------------------------------------------------------------ */}
        <Section id="seating" icon={Armchair} title={ar ? 'مخططات الجلوس بالأسبقية' : 'Seating plans by precedence'} desc={ar ? 'اختر نوع القاعة وعدد الضيوف، وشاهد كل ضيف يأخذ مقعده بالترتيب الصحيح.' : 'Pick the room and guest count, and watch every guest take the right seat in order.'}>
          <div className="flex flex-wrap items-center gap-2 mb-4" role="tablist" aria-label={ar ? 'نوع التخطيط' : 'Layout'}>
            {(Object.keys(LAYOUT_NAMES) as LayoutKind[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={layout === k}
                type="button"
                className={chip(layout === k)}
                onClick={() => {
                  setLayout(k);
                  setCount((c) => Math.min(c, MAX_SEATS[k]));
                  setSelected('seat_2');
                  setPlayKey((n) => n + 1);
                }}
              >
                {tr(locale, LAYOUT_NAMES[k].ar, LAYOUT_NAMES[k].en)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg)] p-1" role="group" aria-label={ar ? 'عدد الضيوف' : 'Guest count'}>
              <button type="button" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)] cursor-pointer disabled:opacity-40" disabled={count <= MIN_SEATS} onClick={() => setCount((c) => Math.max(MIN_SEATS, c - 1))} aria-label={ar ? 'أنقص' : 'Fewer'}>
                <Minus className="w-4 h-4" />
              </button>
              <span className="min-w-[88px] text-center text-sm font-bold tabular-nums text-[var(--ink)]" aria-live="polite">
                {count} {ar ? 'ضيفاً' : 'guests'}
              </span>
              <button type="button" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)] cursor-pointer disabled:opacity-40" disabled={count >= max} onClick={() => setCount((c) => Math.min(max, c + 1))} aria-label={ar ? 'أزِد' : 'More'}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button type="button" onClick={() => setPlayKey((n) => n + 1)} className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 text-sm font-bold text-[var(--bg)] cursor-pointer" data-testid="seat-play">
              <Play className="w-4 h-4" aria-hidden="true" />
              {ar ? 'شغّل الجلوس' : 'Play seating'}
            </button>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-2 sm:p-3">
            <SeatingFloorplan ref={seatRef} layout={layout} seats={seats} locale={locale} selectedId={selected} onSelect={setSelected} animateKey={playKey} />
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-[var(--ink-2)] leading-relaxed max-w-2xl">
              {tr(locale, LAYOUT_NOTE[layout].ar, LAYOUT_NOTE[layout].en)}{' '}
              <button type="button" onClick={() => setRule(LAYOUT_RULE[layout])} className="font-mono text-[11px] underline text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer" dir="ltr">
                {LAYOUT_RULE[layout]}
              </button>
            </p>
            <ExportBar getSvg={() => seatRef.current} name={`wijaha-seating-${layout}`} locale={locale} />
          </div>
          <div className="mt-4">
            <SeatLegend seats={seats} locale={locale} selectedId={selected} onSelect={setSelected} />
          </div>
        </Section>

        {/* 2. Reception ----------------------------------------------------------------- */}
        <Section id="reception" icon={Route} title={ar ? 'مسار الاستقبال المتحرك' : 'The animated reception path'} desc={ar ? 'تابع الضيف خطوة بخطوة من الوصول إلى الوداع، مع ما يُقال ويُفعل في كل محطة.' : 'Follow the guest step by step from arrival to farewell, with what to say and do at each stop.'}>
          <div className="flex flex-wrap gap-2 mb-4" role="tablist">
            {([['majlis', ar ? 'زيارة مجلس خليجي' : 'Gulf majlis visit'], ['delegation', ar ? 'استقبال وفد رسمي' : 'Official delegation']] as Array<[PathVariant, string]>).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={variant === k} type="button" className={chip(variant === k)} onClick={() => setVariant(k)}>
                {label}
              </button>
            ))}
          </div>
          <ReceptionPath key={variant} ref={pathRef} variant={variant} locale={locale} onRuleClick={setRule} />
          <div className="mt-3">
            <ExportBar getSvg={() => pathRef.current} name={`wijaha-reception-${variant}`} locale={locale} />
          </div>
        </Section>

        {/* 3. Table --------------------------------------------------------------------- */}
        <Section id="table" icon={Utensils} title={ar ? 'المائدة الرسمية من الخارج إلى الداخل' : 'The formal table, outside in'} desc={ar ? 'اضغط على كل مرحلة لتضيء الأدوات المناسبة لها، أو شغّل العرض الكامل.' : 'Tap each course to light up the right cutlery, or play the full sequence.'}>
          <PlaceSetting ref={tableRef} locale={locale} onRuleClick={setRule} />
          <div className="mt-3">
            <ExportBar getSvg={() => tableRef.current} name="wijaha-place-setting" locale={locale} />
          </div>
        </Section>

        {/* 4. Podium ---------------------------------------------------------------------- */}
        <Section id="podium" icon={Flag} title={ar ? 'المنصة والأعلام والصورة التذكارية' : 'Podium, flags and the group photo'} desc={ar ? 'ثلاثة مشاهد بروتوكولية شائعة: توقيع اتفاقية، ومنصة كلمة، وصورة تذكارية.' : 'Three common protocol scenes: a signing, a speech stage and a commemorative photo.'}>
          <div className="flex flex-wrap gap-2 mb-4" role="tablist">
            {(Object.keys(SCENE_NAMES) as PodiumScene[]).map((k) => (
              <button key={k} role="tab" aria-selected={scene === k} type="button" className={chip(scene === k)} onClick={() => setScene(k)}>
                {tr(locale, SCENE_NAMES[k].ar, SCENE_NAMES[k].en)}
              </button>
            ))}
          </div>
          <PodiumFlags ref={podiumRef} scene={scene} locale={locale} onRuleClick={setRule} />
          <div className="mt-3">
            <ExportBar getSvg={() => podiumRef.current} name={`wijaha-${scene}`} locale={locale} />
          </div>
        </Section>

        {/* 5. Share card ------------------------------------------------------------------- */}
        <Section id="card" icon={GalleryVerticalEnd} title={ar ? 'بطاقة المشاركة' : 'The share card'} desc={ar ? 'حوّل أي نصيحة إلى بطاقة أنيقة بمقاس 4:5 جاهزة لواتساب وإنستغرام.' : 'Turn any advice into an elegant 4:5 card ready for WhatsApp and Instagram.'}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="rounded-2xl overflow-hidden border border-[var(--line)] shadow-sm max-w-[420px] w-full mx-auto">
              <ShareCard ref={cardRef} locale={locale} kicker={kicker} title={title} points={points} accent={accent} />
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--ink-2)]">{ar ? 'الشارة العلوية' : 'Top label'}</span>
                <input value={kicker} onChange={(e) => setKicker(e.target.value.slice(0, 40))} className="mt-1 w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--ink-2)]">{ar ? 'العنوان' : 'Title'}</span>
                <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 90))} className="mt-1 w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--ink-2)]">{ar ? 'النقاط (سطر لكل نقطة، حتى 5)' : 'Points (one per line, up to 5)'}</span>
                <textarea value={pointsText} onChange={(e) => setPointsText(e.target.value.slice(0, 700))} rows={6} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm leading-relaxed" />
              </label>
              <div>
                <span className="text-xs font-semibold text-[var(--ink-2)] block mb-1.5">{ar ? 'اللون' : 'Accent'}</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ar ? 'اللون' : 'Accent'}>
                  {(Object.keys(ACCENTS) as CardAccent[]).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={accent === k} onClick={() => setAccent(k)} className={`${chip(accent === k)} inline-flex items-center gap-2`}>
                      <span className="w-3.5 h-3.5 rounded-full" style={{ background: ACCENTS[k].main }} aria-hidden="true" />
                      {tr(locale, ACCENTS[k].name.ar, ACCENTS[k].name.en)}
                    </button>
                  ))}
                </div>
              </div>
              <ExportBar getSvg={() => cardRef.current} name="wijaha-card" locale={locale} share scale={1} />
            </div>
          </div>
        </Section>

        {/* 6. Timeline ------------------------------------------------------------------------ */}
        <Section id="timeline" icon={Camera} title={ar ? 'برنامج الزيارة المصوّر' : 'The illustrated visit programme'} desc={ar ? 'كل بند يأخذ أيقونته ولونه تلقائياً، والبرنامج يظهر تدريجياً كما تتصفحه.' : 'Every item gets its icon and colour automatically, and the programme unfolds as you scroll.'}>
          <VisualTimeline days={ar ? SAMPLE_PROGRAM_AR : SAMPLE_PROGRAM_EN} locale={locale} onInspectRule={setRule} />
        </Section>
      </div>
      <RuleDialog ruleId={rule} locale={locale} onClose={() => setRule(null)} />
    </AppShell>
  );
}
