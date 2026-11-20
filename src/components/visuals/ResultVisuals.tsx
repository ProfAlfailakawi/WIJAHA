import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ImageDown, Route, Share2, Sparkles, Utensils } from 'lucide-react';
import { Dialog } from '../ui/Primitives';
import type { WijahaResult } from '../../shared/types';
import { downloadPng, shareOrDownloadPng } from './export.ts';
import { PlaceSetting } from './PlaceSetting';
import { ReceptionPath, type PathVariant } from './ReceptionPath';
import { ACCENTS, ShareCard, type CardAccent } from './ShareCard';
import { pointsFromResult } from '../../shared/visuals/card-points.ts';
import { tr } from './svg-kit.tsx';

const GULF = /الكويت|السعود|الإمارات|الامارات|قطر|البحرين|عُمان|عمان|الخليج|Kuwait|Saudi|Emirates|UAE|Qatar|Bahrain|Oman|Gulf/i;

const KICKER: Record<string, { ar: string; en: string }> = {
  delegation_visit_host: { ar: 'استقبال الوفود', en: 'Hosting delegations' },
  hosting_hospitality: { ar: 'الضيافة الرسمية', en: 'Official hospitality' },
  gift_question: { ar: 'الهدايا الرسمية', en: 'Official gifts' },
  greeting_titles: { ar: 'الألقاب والمخاطبة', en: 'Titles & address' },
  dress_code: { ar: 'اللباس الرسمي', en: 'Dress code' },
  seating_precedence: { ar: 'الجلوس والأسبقية', en: 'Seating & precedence' },
  cultural_briefing: { ar: 'ثقافة الأعمال', en: 'Business culture' },
  dining_etiquette: { ar: 'آداب المائدة', en: 'Dining etiquette' },
  business_trip_abroad: { ar: 'زيارة عمل', en: 'Business trip' },
  formal_invitation: { ar: 'الدعوات الرسمية', en: 'Formal invitations' },
};

function Collapsible({ icon: Icon, title, hint, children }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-start cursor-pointer min-h-[56px]">
        <span className="w-10 h-10 rounded-xl bg-[var(--t-gold)] text-[var(--c-gold)] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-[var(--ink)]">{title}</span>
          <span className="block text-xs text-[var(--ink-3)]">{hint}</span>
        </span>
        <ChevronDown className={`w-5 h-5 text-[var(--ink-3)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="px-3 sm:px-4 pb-4">{children}</div>}
    </div>
  );
}

/** Visual aids that follow the answer: animated path, place setting and a shareable card. */
export function ResultVisuals({ result, locale, onInspectRule }: { result: WijahaResult; locale: string; onInspectRule?: (id: string) => void }) {
  const [cardOpen, setCardOpen] = useState(false);
  const [accent, setAccent] = useState<CardAccent>('gold');
  const cardRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);

  const gulf = result.context.some((c) => GULF.test(c.label));
  const variant: PathVariant = gulf ? 'majlis' : 'delegation';
  const showPath = result.intent === 'delegation_visit_host' || result.intent === 'hosting_hospitality';
  const showTable = result.intent === 'dining_etiquette' || result.intent === 'hosting_hospitality';
  const points = useMemo(() => pointsFromResult(result), [result]);
  const kicker = tr(locale, (KICKER[result.intent] ?? { ar: 'دليل سريع', en: 'Quick guide' }).ar, (KICKER[result.intent] ?? { ar: 'دليل سريع', en: 'Quick guide' }).en);

  const run = async (fn: (svg: SVGSVGElement) => Promise<unknown>) => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      await fn(cardRef.current);
    } finally {
      setBusy(false);
    }
  };
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const btn = 'min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-50 cursor-pointer';

  return (
    <section className="no-print space-y-3" aria-label={tr(locale, 'مرئيات مساعدة', 'Visual aids')}>
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--gold-ink)] uppercase">
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
        {tr(locale, 'شاهدها بدل أن تقرأها', 'See it instead of reading it')}
      </div>
      {showPath && (
        <Collapsible icon={Route} title={tr(locale, 'مسار الاستقبال المتحرك', 'Animated reception path')} hint={tr(locale, variant === 'majlis' ? 'زيارة مجلس خليجي من الباب إلى الوداع' : 'استقبال وفد رسمي من الوصول إلى الوداع', variant === 'majlis' ? 'A Gulf majlis visit from the door to farewell' : 'An official delegation from arrival to farewell')}>
          <ReceptionPath variant={variant} locale={locale} onRuleClick={onInspectRule} />
        </Collapsible>
      )}
      {showTable && (
        <Collapsible icon={Utensils} title={tr(locale, 'المائدة الرسمية من الخارج إلى الداخل', 'The formal table, outside in')} hint={tr(locale, 'أي أداة لأي طبق؟', 'Which utensil for which course?')}>
          <PlaceSetting locale={locale} onRuleClick={onInspectRule} />
        </Collapsible>
      )}
      <button type="button" onClick={() => setCardOpen(true)} className="w-full rounded-2xl border border-dashed border-[var(--gold)] bg-[var(--t-gold)]/40 px-4 py-3.5 flex items-center gap-3 text-start cursor-pointer min-h-[56px] hover:bg-[var(--t-gold)]/70 transition-colors" data-testid="open-share-card">
        <span className="w-10 h-10 rounded-xl bg-[var(--primary)] text-[var(--bg)] flex items-center justify-center shrink-0">
          <Share2 className="w-5 h-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-[var(--ink)]">{tr(locale, 'حوّلها إلى بطاقة للمشاركة', 'Turn it into a shareable card')}</span>
          <span className="block text-xs text-[var(--ink-3)]">{tr(locale, 'صورة جاهزة لواتساب وإنستغرام بخمس نقاط', 'An image ready for WhatsApp and Instagram with five points')}</span>
        </span>
      </button>

      <Dialog open={cardOpen} onClose={() => setCardOpen(false)} title={tr(locale, 'بطاقة المشاركة', 'Share card')} subtitle={tr(locale, 'تُحمَّل كصورة PNG بجودة عالية', 'Downloads as a high-quality PNG')}>
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-[var(--line)] shadow-sm max-w-[400px] mx-auto">
            <ShareCard ref={cardRef} locale={locale} kicker={kicker} title={result.title} points={points} accent={accent} />
          </div>
          <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label={tr(locale, 'اللون', 'Accent')}>
            {(Object.keys(ACCENTS) as CardAccent[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={accent === k}
                onClick={() => setAccent(k)}
                className={`min-h-[40px] inline-flex items-center gap-2 rounded-full border px-3.5 text-xs font-semibold cursor-pointer ${accent === k ? 'bg-[var(--primary)] text-[var(--bg)] border-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--ink-2)] border-[var(--line)]'}`}
              >
                <span className="w-3 h-3 rounded-full" style={{ background: ACCENTS[k].main }} aria-hidden="true" />
                {tr(locale, ACCENTS[k].name.ar, ACCENTS[k].name.en)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={btn} disabled={busy} onClick={() => run((s) => downloadPng(s, 'wijaha-card', 1))} data-testid="card-png">
              <ImageDown className="w-4 h-4" aria-hidden="true" />
              {tr(locale, 'حمّل PNG', 'Download PNG')}
            </button>
            {canShare && (
              <button type="button" className={btn} disabled={busy} onClick={() => run((s) => shareOrDownloadPng(s, 'wijaha-card', result.title, 1))}>
                <Share2 className="w-4 h-4" aria-hidden="true" />
                {tr(locale, 'مشاركة', 'Share')}
              </button>
            )}
          </div>
        </div>
      </Dialog>
    </section>
  );
}
