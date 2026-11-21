import React, { forwardRef, useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import { svgDir, tr, useSvgIds, VisualDefs } from './svg-kit.tsx';

type Item = 'napkin' | 'f1' | 'f2' | 'k1' | 'k2' | 'spoon' | 'dSpoon' | 'dFork' | 'bread' | 'water' | 'drink';

interface Step {
  items: Item[];
  titleAr: string;
  titleEn: string;
  textAr: string;
  textEn: string;
  rule: string;
}

const STEPS: Step[] = [
  { items: ['napkin'], titleAr: 'المنديل', titleEn: 'The napkin', textAr: 'يُفرد المنديل على الحجر عند جلوس المضيف أو عند بدء الأكل، ويُوضع على الكرسي عند المغادرة المؤقتة لا على الطاولة.', textEn: 'Unfold the napkin on your lap when the host sits or begins, and leave it on your chair, not the table, when stepping away.', rule: 'R-DEMO-0003' },
  { items: ['f1', 'k1', 'bread'], titleAr: 'المقبلات والخبز', titleEn: 'Starter and bread', textAr: 'ابدأ من الخارج إلى الداخل: الشوكة والسكين الأبعدان للمقبلات. طبق الخبز عن اليسار.', textEn: 'Work from the outside in: the outermost fork and knife are for the starter. The bread plate sits on the left.', rule: 'R-DEMO-0002' },
  { items: ['spoon'], titleAr: 'الشوربة', titleEn: 'The soup', textAr: 'ملعقة الشوربة هي الأبعد يميناً. تُغرف الشوربة بعيداً عنك وتُؤكل من جانب الملعقة.', textEn: 'The soup spoon is the outermost on the right. Spoon the soup away from you and sip from the side of the spoon.', rule: 'R-DEMO-0002' },
  { items: ['f2', 'k2'], titleAr: 'الطبق الرئيسي', titleEn: 'The main course', textAr: 'الشوكة والسكين الأقرب إلى الطبق هما للطبق الرئيسي. ومن يضع أدواته متقاطعة أو متوازية على الطبق يُشير إلى أنه انتهى.', textEn: 'The inner fork and knife are for the main course. Placing them together on the plate signals that you have finished.', rule: 'R-DEMO-0002' },
  { items: ['dSpoon', 'dFork'], titleAr: 'الحلوى', titleEn: 'Dessert', textAr: 'أدوات الحلوى فوق الطبق: الملعقة وقبضتها إلى اليمين، والشوكة وقبضتها إلى اليسار. تُرفع عند التقديم.', textEn: 'Dessert cutlery lies above the plate: the spoon with its handle to the right, the fork with its handle to the left.', rule: 'R-DEMO-0002' },
  { items: ['water', 'drink'], titleAr: 'المشروبات', titleEn: 'Drinks', textAr: 'الكؤوس عن اليمين فوق السكاكين. في الفعاليات الخليجية الرسمية تُقدَّم المياه والعصائر والقهوة فقط.', textEn: 'Glasses sit on the right above the knives. At official Gulf events only water, juices and coffee are served.', rule: 'R-ARAB-012' },
];

interface Props {
  locale: string;
  className?: string;
  onRuleClick?: (id: string) => void;
}

export const PlaceSetting = forwardRef<SVGSVGElement, Props>(function PlaceSetting({ locale, className, onRuleClick }, ref) {
  const p = useSvgIds();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [gulf, setGulf] = useState(true);
  const cur = STEPS[step];

  useEffect(() => {
    if (!playing || reduced) return;
    if (step >= STEPS.length - 1) {
      const t = setTimeout(() => setPlaying(false), 1800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 2800);
    return () => clearTimeout(t);
  }, [playing, step, reduced]);

  const on = (i: Item) => cur.items.includes(i);
  const op = (i: Item) => (on(i) ? 1 : 0.38);
  const glow = (i: Item) => (on(i) ? { filter: `url(#${p}-glow)` } : {});
  const silver = `url(#${p}-silver)`;

  const Fork = ({ x, id }: { x: number; id: Item }) => (
    <g transform={`translate(${x} 214)`} opacity={op(id)} {...glow(id)}>
      <rect x="-5.5" y="62" width="11" height="96" rx="5.5" fill={silver} stroke="#7b8497" strokeWidth="1" />
      <path d="M-13 0V34Q-13 52 0 60Q13 52 13 34V0" fill={silver} stroke="#7b8497" strokeWidth="1.1" />
      {[-9, -3, 3, 9].map((tx) => (
        <line key={tx} x1={tx} y1="-1" x2={tx} y2="30" stroke="var(--surface)" strokeWidth="2.2" />
      ))}
    </g>
  );
  const Knife = ({ x, id }: { x: number; id: Item }) => (
    <g transform={`translate(${x} 214)`} opacity={op(id)} {...glow(id)}>
      <rect x="-6" y="82" width="12" height="76" rx="6" fill={silver} stroke="#7b8497" strokeWidth="1" />
      <path d="M-7 0Q10 8 10 50V86H-7Z" fill={silver} stroke="#7b8497" strokeWidth="1.1" />
    </g>
  );

  return (
    <div className={className}>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-2 sm:p-3 overflow-hidden">
        <svg ref={ref} viewBox="0 0 720 470" role="img" aria-label={tr(locale, 'ترتيب المائدة الرسمية', 'Formal place setting')} className="w-full h-auto select-none" style={{ direction: svgDir(locale) }}>
          <VisualDefs p={p} />
          <defs>
            <linearGradient id={`${p}-silver`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f3f6fb" />
              <stop offset="0.5" stopColor="#c0c8d6" />
              <stop offset="1" stopColor="#8f99ac" />
            </linearGradient>
            <radialGradient id={`${p}-plate`} cx="0.4" cy="0.35" r="0.9">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#e7e1d3" />
            </radialGradient>
            <filter id={`${p}-glow`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#e2c07a" floodOpacity="0.95" />
            </filter>
          </defs>
          <rect x="6" y="6" width="708" height="458" rx="24" fill="var(--surface-2)" stroke="var(--ink-3)" strokeWidth="2" />
          {/* linen placemat */}
          <rect x="70" y="40" width="580" height="390" rx="20" fill="#f7f0df" stroke="#e2c07a" strokeWidth="2.4" />
          <rect x="82" y="52" width="556" height="366" rx="14" fill="none" stroke="#e2c07a" strokeWidth="1" strokeDasharray="3 6" />

          {/* plates */}
          <g filter={`url(#${p}-shadow)`}>
            <circle cx="360" cy="282" r="98" fill="#d9b66b" />
            <circle cx="360" cy="282" r="91" fill="#e6c67e" />
            <circle cx="360" cy="282" r="77" fill={`url(#${p}-plate)`} />
            <circle cx="360" cy="282" r="56" fill="none" stroke="#d8cfba" strokeWidth="1.6" />
          </g>
          <g transform="translate(360 282) rotate(-28)" opacity={op('napkin')} {...glow('napkin')}>
            <rect x="-40" y="-26" width="80" height="52" rx="6" fill="#fffdf6" stroke="#cdbf9a" strokeWidth="1.4" />
            <path d="M-40 -3H40M-5 -26V26" stroke="#e3d8b7" strokeWidth="1.4" />
            <rect x="-40" y="-26" width="80" height="52" rx="6" fill={`url(#${p}-sheen)`} />
          </g>

          {/* left: forks (outside to inside) and bread plate */}
          <Fork x={184} id="f1" />
          <Fork x={228} id="f2" />
          <g opacity={op('bread')} {...glow('bread')}>
            <circle cx="118" cy="150" r="38" fill={`url(#${p}-plate)`} stroke="#d8cfba" strokeWidth="1.6" />
            <circle cx="118" cy="150" r="26" fill="none" stroke="#e6dfcb" />
            <g transform="translate(118 150) rotate(60)">
              <rect x="-3" y="-30" width="6" height="52" rx="3" fill={silver} stroke="#7b8497" strokeWidth="0.8" />
              <path d="M-3 -30Q9 -22 4 6H-3Z" fill={silver} stroke="#7b8497" strokeWidth="0.8" />
            </g>
          </g>

          {/* right: knives then soup spoon (outside to inside = right to left) */}
          <Knife x={490} id="k2" />
          <Knife x={534} id="k1" />
          <g transform="translate(580 214)" opacity={op('spoon')} {...glow('spoon')}>
            <rect x="-5.5" y="60" width="11" height="98" rx="5.5" fill={silver} stroke="#7b8497" strokeWidth="1" />
            <ellipse cx="0" cy="26" rx="15" ry="26" fill={silver} stroke="#7b8497" strokeWidth="1.1" />
            <ellipse cx="0" cy="26" rx="9" ry="18" fill="none" stroke="#9aa4b6" strokeWidth="0.8" />
          </g>

          {/* above the plate: dessert spoon and fork */}
          <g transform="translate(300 128) rotate(-90)" opacity={op('dSpoon')} {...glow('dSpoon')}>
            <rect x="-4.5" y="36" width="9" height="78" rx="4.5" fill={silver} stroke="#7b8497" strokeWidth="0.9" />
            <ellipse cx="0" cy="16" rx="11" ry="20" fill={silver} stroke="#7b8497" strokeWidth="1" />
          </g>
          <g transform="translate(420 152) rotate(90)" opacity={op('dFork')} {...glow('dFork')}>
            <rect x="-4.5" y="40" width="9" height="74" rx="4.5" fill={silver} stroke="#7b8497" strokeWidth="0.9" />
            <path d="M-10 0V26Q-10 40 0 46Q10 40 10 26V0" fill={silver} stroke="#7b8497" strokeWidth="1" />
            {[-6, 0, 6].map((tx) => (
              <line key={tx} x1={tx} y1="-1" x2={tx} y2="24" stroke="#f7f0df" strokeWidth="1.8" />
            ))}
          </g>

          {/* drinks: water goblet and a juice (Gulf) or wine (international) glass */}
          <g opacity={op('water')} {...glow('water')}>
            <circle cx="500" cy="122" r="26" fill="#cfe9f3" fillOpacity="0.8" stroke="#8fb9cb" strokeWidth="2" />
            <circle cx="500" cy="122" r="15" fill="#e8f6fb" fillOpacity="0.9" />
          </g>
          <g opacity={op('drink')} {...glow('drink')}>
            <circle cx="556" cy="172" r="21" fill={gulf ? '#f4a340' : '#8f2f2a'} fillOpacity="0.85" stroke={gulf ? '#c97a14' : '#5e1a17'} strokeWidth="2" />
            <circle cx="556" cy="172" r="11" fill="#ffffff" fillOpacity="0.28" />
          </g>

          {/* labels */}
          <g fontSize="13" fontWeight="700" fill="var(--ink-2)">
            <text x="184" y="392" textAnchor="middle">{tr(locale, 'شوكة المقبلات', 'Starter fork')}</text>
            <text x="228" y="410" textAnchor="middle">{tr(locale, 'شوكة رئيسية', 'Main fork')}</text>
            <text x="490" y="410" textAnchor="middle">{tr(locale, 'سكين رئيسي', 'Main knife')}</text>
            <text x="534" y="392" textAnchor="middle">{tr(locale, 'سكين المقبلات', 'Starter knife')}</text>
            <text x="580" y="410" textAnchor="middle">{tr(locale, 'ملعقة الشوربة', 'Soup spoon')}</text>
            <text x="118" y="206" textAnchor="middle">{tr(locale, 'الخبز', 'Bread')}</text>
            <text x="360" y="102" textAnchor="middle">{tr(locale, 'أدوات الحلوى', 'Dessert')}</text>
            <text x="500" y="80" textAnchor="middle">{tr(locale, 'الماء', 'Water')}</text>
            <text x="556" y="210" textAnchor="middle">{gulf ? tr(locale, 'عصير', 'Juice') : tr(locale, 'مشروب', 'Wine')}</text>
          </g>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={tr(locale, 'مراحل الطعام', 'Courses')}>
        {STEPS.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === step}
            onClick={() => {
              setPlaying(false);
              setStep(i);
            }}
            className={`min-h-[40px] rounded-full border px-3.5 text-xs font-semibold cursor-pointer transition-colors ${
              i === step ? 'bg-[var(--primary)] text-[var(--bg)] border-[var(--primary)]' : 'bg-[var(--surface)] text-[var(--ink-2)] border-[var(--line)] hover:text-[var(--ink)]'
            }`}
          >
            <span className="tabular-nums">{i + 1}</span> · {tr(locale, s.titleAr, s.titleEn)}
          </button>
        ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!playing && step >= STEPS.length - 1) setStep(0);
            setPlaying((v) => !v);
          }}
          className="ms-auto w-10 h-10 rounded-full bg-[var(--primary)] text-[var(--bg)] flex items-center justify-center cursor-pointer"
          aria-label={playing ? tr(locale, 'إيقاف مؤقت', 'Pause') : tr(locale, 'تشغيل', 'Play')}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" aria-live="polite">
        <h3 className="text-base font-bold text-[var(--ink)]">{tr(locale, cur.titleAr, cur.titleEn)}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-2)]">{tr(locale, cur.textAr, cur.textEn)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => onRuleClick?.(cur.rule)} className="font-mono text-[11px] rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer" dir="ltr">
            {cur.rule}
          </button>
          <label className="inline-flex items-center gap-2 text-xs text-[var(--ink-2)] cursor-pointer">
            <input type="checkbox" checked={gulf} onChange={(e) => setGulf(e.target.checked)} className="accent-[var(--gold)] w-4 h-4" />
            {tr(locale, 'نمط الفعاليات الخليجية الرسمية (بلا كحول)', 'Official Gulf event style (no alcohol)')}
          </label>
        </div>
      </div>
    </div>
  );
});
