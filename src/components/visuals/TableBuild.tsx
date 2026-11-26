import React, { useRef, useState } from 'react';
import { useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';

/**
 * "The table builds itself": as the visitor scrolls, the place-setting pieces lower onto the table from the
 * outside in, each with its label; then a "spot the mistake" mini game with a few wrong settings to find.
 * Static SVG (no three.js); the drawing is physical so it keeps forks on the left in both languages.
 */

type Kind = 'charger' | 'fork' | 'knife' | 'spoon' | 'bread' | 'dSpoon' | 'dFork' | 'water' | 'drink' | 'napkin' | 'card';

interface PieceDef {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  ar: string;
  en: string;
  /** label side */
  side?: 'above' | 'below';
}

/** Where each piece's number badge sits, relative to the piece. */
const BADGE: Record<string, [number, number]> = {
  charger: [0, 102], soup: [0, 102], fork1: [0, -104], knife1: [0, -104], fork2: [0, -104], knife2: [0, -104],
  bread: [42, -30], dSpoon: [-64, -2], dFork: [64, 2], water: [0, -36], drink: [32, -24], napkin: [0, 0], card: [-62, 0],
};

const SETTING: PieceDef[] = [
  { id: 'charger', kind: 'charger', x: 360, y: 260, ar: 'طبق التقديم', en: 'Charger plate', side: 'below' },
  { id: 'soup', kind: 'spoon', x: 540, y: 260, ar: 'ملعقة الشوربة (الأبعد يميناً)', en: 'Soup spoon (outermost right)', side: 'below' },
  { id: 'fork1', kind: 'fork', x: 196, y: 260, ar: 'شوكة المقبلات', en: 'Starter fork', side: 'below' },
  { id: 'knife1', kind: 'knife', x: 508, y: 260, ar: 'سكين المقبلات', en: 'Starter knife', side: 'above' },
  { id: 'fork2', kind: 'fork', x: 230, y: 260, ar: 'شوكة الطبق الرئيسي', en: 'Main fork', side: 'above' },
  { id: 'knife2', kind: 'knife', x: 476, y: 260, ar: 'سكين الطبق الرئيسي', en: 'Main knife', side: 'below' },
  { id: 'bread', kind: 'bread', x: 200, y: 112, ar: 'طبق الخبز عن اليسار', en: 'Bread plate on the left', side: 'above' },
  { id: 'dSpoon', kind: 'dSpoon', x: 360, y: 150, ar: 'ملعقة الحلوى', en: 'Dessert spoon', side: 'above' },
  { id: 'dFork', kind: 'dFork', x: 360, y: 168, ar: 'شوكة الحلوى', en: 'Dessert fork', side: 'below' },
  { id: 'water', kind: 'water', x: 500, y: 118, ar: 'كأس الماء فوق السكين', en: 'Water glass above the knife', side: 'above' },
  { id: 'drink', kind: 'drink', x: 548, y: 142, ar: 'كأس العصير', en: 'Juice glass', side: 'below' },
  { id: 'napkin', kind: 'napkin', x: 360, y: 260, ar: 'المنديل فوق الطبق', en: 'Napkin on the plate', side: 'above' },
  { id: 'card', kind: 'card', x: 360, y: 74, ar: 'بطاقة الاسم', en: 'Place card', side: 'above' },
];

const SILVER = '#c3cbd8';
const EDGE = '#7b8497';

function Shape({ kind, mirror }: { kind: Kind; mirror?: boolean }) {
  switch (kind) {
    case 'charger':
      return (
        <g>
          <circle r="86" fill="#f6efe0" stroke="#C9A24F" strokeWidth="3" />
          <circle r="64" fill="#fffdf8" stroke="#d9c7a3" strokeWidth="1.5" />
        </g>
      );
    case 'fork':
      return (
        <g>
          <rect x="-5" y="-40" width="10" height="126" rx="5" fill={SILVER} stroke={EDGE} />
          <path d="M-12 -90V-56Q-12 -40 0 -34Q12 -40 12 -56V-90" fill={SILVER} stroke={EDGE} />
        </g>
      );
    case 'knife':
      return (
        <g>
          <rect x="-6" y="0" width="12" height="86" rx="6" fill={SILVER} stroke={EDGE} />
          <path d="M-6 -90Q10 -82 10 -40V4H-6Z" fill={SILVER} stroke={EDGE} />
        </g>
      );
    case 'spoon':
      return (
        <g>
          <rect x="-5" y="-30" width="10" height="116" rx="5" fill={SILVER} stroke={EDGE} />
          <ellipse cy="-62" rx="15" ry="26" fill={SILVER} stroke={EDGE} />
        </g>
      );
    case 'bread':
      return (
        <g>
          <circle r="34" fill="#fffdf8" stroke="#d9c7a3" strokeWidth="2" />
          <rect x="-28" y="-4" width="56" height="7" rx="3.5" fill={SILVER} stroke={EDGE} transform="rotate(-20)" />
        </g>
      );
    case 'dSpoon':
      return (
        <g transform={mirror ? 'scale(-1 1)' : undefined}>
          <rect x="-46" y="-3.5" width="70" height="7" rx="3.5" fill={SILVER} stroke={EDGE} />
          <ellipse cx="36" rx="14" ry="8" fill={SILVER} stroke={EDGE} />
        </g>
      );
    case 'dFork':
      return (
        <g transform={mirror ? 'scale(-1 1)' : undefined}>
          <rect x="-24" y="-3.5" width="70" height="7" rx="3.5" fill={SILVER} stroke={EDGE} />
          <path d="M-24 -9H-46M-24 -3H-46M-24 3H-46M-24 9H-46" stroke={EDGE} strokeWidth="2.5" />
        </g>
      );
    case 'water':
      return (
        <g>
          <circle r="22" fill="#e7f1f7" fillOpacity=".75" stroke="#9fb6c6" strokeWidth="2" />
          <circle r="15" fill="none" stroke="#c8dbe7" />
        </g>
      );
    case 'drink':
      return (
        <g>
          <circle r="18" fill="#f8e3c2" fillOpacity=".8" stroke="#c99a5a" strokeWidth="2" />
        </g>
      );
    case 'napkin':
      return <path d="M-34 -30L34 -30L22 30L-22 30Z" fill="#14213d" fillOpacity=".9" stroke="#C9A24F" strokeWidth="2" />;
    case 'card':
      return (
        <g>
          <rect x="-46" y="-16" width="92" height="32" rx="3" fill="#fffdf8" stroke="#C9A24F" strokeWidth="1.5" />
          <path d="M-28 0H28" stroke="#d9c7a3" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
  }
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 720 420" className="w-full h-auto select-none" style={{ direction: 'ltr' }}>
      <rect x="10" y="20" width="700" height="390" rx="18" fill="#f3ead6" stroke="#d9c7a3" />
      <rect x="22" y="32" width="676" height="366" rx="12" fill="none" stroke="#e7dbc2" strokeDasharray="4 6" />
      {children}
    </svg>
  );
}

export function TableBuild({ ar }: { ar: boolean }) {
  // iPhone Duo panes scroll on their own (not the window), so there the setting is shown complete.
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.device === 'duo');
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.85'] });
  const [p, setP] = useState(reduced ? 1 : 0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!reduced) setP(v);
  });
  const progress = reduced ? 1 : p;
  const n = SETTING.length;

  return (
    <section className="wj-tablebuild" aria-labelledby="tb-h" data-testid="table-build">
      <h2 id="tb-h" className="text-2xl text-[var(--ink)]">{ar ? 'الطاولة ترتّب نفسها' : 'The table builds itself'}</h2>
      <p className="text-sm text-[var(--ink-2)] mt-1">{ar ? 'مرّر الصفحة لتنزل القطع من الخارج إلى الداخل.' : 'Scroll and the pieces come down from the outside in.'}</p>
      <div ref={ref} className="wj-tablebuild-track">
        <div className="wj-tablebuild-sticky">
          <Table>
            {SETTING.map((d, i) => {
              const local = Math.max(0, Math.min(1, progress * (n + 1) - i));
              const e = 1 - Math.pow(1 - local, 3);
              return (
                <g key={d.id} transform={`translate(${d.x} ${d.y - (1 - e) * 140})`} opacity={e} data-piece={d.id}>
                  <g transform={`scale(${1 + (1 - e) * 0.25})`}>
                    <Shape kind={d.kind} />
                  </g>
                  {local >= 1 && (
                    <g transform={`translate(${BADGE[d.id][0]} ${BADGE[d.id][1]})`} className="wj-tablebuild-badge">
                      <circle r="11" />
                      <text textAnchor="middle" dominantBaseline="central">{i + 1}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </Table>
          <ol className="wj-tablebuild-legend" aria-label={ar ? 'ترتيب القطع' : 'Order of the pieces'}>
            {SETTING.map((d, i) => {
              const landed = progress * (n + 1) - i >= 1;
              const latest = landed && progress * (n + 1) - (i + 1) < 1;
              return (
                <li key={d.id} data-landed={landed ? 'true' : 'false'} data-latest={latest ? 'true' : 'false'}>
                  <span className="wj-tablebuild-num">{i + 1}</span>
                  {ar ? d.ar : d.en}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <SpotTheMistake ar={ar} />
    </section>
  );
}

/* ----------------------------------------------------------- spot the mistake */
interface Round {
  wrong: string;
  /** piece overrides: id -> new x/y (or mirrored) */
  move: Record<string, { x?: number; y?: number; mirror?: boolean }>;
  whyAr: string;
  whyEn: string;
}

const ROUNDS: Round[] = [
  { wrong: 'bread', move: { bread: { x: 548, y: 210 } }, whyAr: 'طبق الخبز مكانه عن اليسار فوق الشوك، لا عن اليمين.', whyEn: 'The bread plate belongs on the left above the forks, not on the right.' },
  { wrong: 'water', move: { water: { x: 196, y: 150 } }, whyAr: 'الكؤوس عن اليمين فوق السكاكين؛ كأس الماء أولاً.', whyEn: 'Glasses sit on the right above the knives, water first.' },
  { wrong: 'fork1', move: { fork1: { x: 572 } }, whyAr: 'الشوك كلها عن اليسار؛ لا توضع شوكة بجانب السكاكين.', whyEn: 'All forks go on the left; no fork beside the knives.' },
  { wrong: 'dSpoon', move: { dSpoon: { mirror: true } }, whyAr: 'قبضة ملعقة الحلوى إلى اليمين، وقبضة شوكتها إلى اليسار.', whyEn: 'The dessert spoon’s handle points right; the dessert fork’s handle points left.' },
];

function SpotTheMistake({ ar }: { ar: boolean }) {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const r = ROUNDS[round % ROUNDS.length];
  const solved = picked === r.wrong;
  const done = round >= ROUNDS.length;

  const pick = (id: string) => {
    if (solved || done) return;
    if (id === r.wrong && picked !== r.wrong) setScore((s) => s + (picked === null ? 1 : 0));
    setPicked(id);
  };
  const next = () => {
    setPicked(null);
    setRound((n) => n + 1);
  };
  const reset = () => {
    setPicked(null);
    setScore(0);
    setRound(0);
  };
  const pieces = SETTING.filter((d) => d.id !== 'napkin');

  return (
    <div className="wj-spot" data-testid="spot-mistake">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl text-[var(--ink)]">{ar ? 'اكتشف الخطأ' : 'Spot the mistake'}</h3>
        <span className="text-sm text-[var(--ink-2)] tabular-nums">{ar ? `النتيجة ${score} من ${ROUNDS.length}` : `Score ${score} of ${ROUNDS.length}`}</span>
      </div>
      {done ? (
        <div className="mt-3 space-y-3">
          <p className="text-[var(--ink)] font-semibold">{ar ? `انتهت الجولات: أصبت ${score} من ${ROUNDS.length} من أول محاولة.` : `All rounds done: ${score} of ${ROUNDS.length} on the first try.`}</p>
          <button type="button" onClick={reset} className="wj-spot-btn" data-testid="spot-reset">
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            {ar ? 'العب مرة أخرى' : 'Play again'}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--ink-2)]">{ar ? `الجولة ${round + 1}: قطعة واحدة في غير مكانها. انقر عليها.` : `Round ${round + 1}: one piece is in the wrong place. Tap it.`}</p>
          <Table>
            {pieces.map((d) => {
              const mv = r.move[d.id] ?? {};
              const x = mv.x ?? d.x;
              const y = mv.y ?? d.y;
              const state = picked === d.id ? (d.id === r.wrong ? 'right' : 'wrong') : solved && d.id === r.wrong ? 'right' : 'idle';
              return (
                <g
                  key={d.id}
                  transform={`translate(${x} ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={ar ? d.ar.split(' (')[0] : d.en.split(' (')[0]}
                  className="wj-spot-piece"
                  data-state={state}
                  data-piece={d.id}
                  onClick={() => pick(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pick(d.id);
                    }
                  }}
                >
                  <Shape kind={d.kind} mirror={mv.mirror} />
                </g>
              );
            })}
          </Table>
          <div className="min-h-[52px] mt-2" aria-live="polite">
            {picked && (solved ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-2 text-[var(--success)] font-semibold"><CheckCircle2 className="w-5 h-5" aria-hidden="true" />{ar ? r.whyAr : r.whyEn}</p>
                <button type="button" onClick={next} className="wj-spot-btn" data-testid="spot-next">{ar ? 'التالي' : 'Next'}</button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-[var(--danger)] font-semibold"><XCircle className="w-5 h-5" aria-hidden="true" />{ar ? 'هذه في مكانها الصحيح. جرّب قطعة أخرى.' : 'That one is in the right place. Try another piece.'}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
