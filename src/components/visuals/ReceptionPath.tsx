import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  Armchair,
  Building2,
  Camera,
  Car,
  Coffee,
  DoorOpen,
  Flame,
  Gift,
  Handshake,
  MessagesSquare,
  Pause,
  Play,
  Plane,
  SkipBack,
  SkipForward,
  Users,
  Utensils,
} from 'lucide-react';
import { anchorFor, svgDir, tr, useSvgIds, VisualDefs } from './svg-kit.tsx';

export type PathVariant = 'majlis' | 'delegation';

interface Station {
  x: number;
  y: number;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  rules: string[];
}

const MAJLIS: Station[] = [
  { x: 86, y: 352, icon: Car, titleAr: 'الوصول إلى الباب', titleEn: 'Arrival at the gate', detailAr: 'تصل في الموعد المحدد حتى لو تأخر المضيف، فالتأخر أو التبكير يُربكان البرنامج.', detailEn: 'Arrive on time even if the host runs late; early or late arrivals disrupt the programme.', rules: ['R-ARAB-026'] },
  { x: 226, y: 286, icon: DoorOpen, titleAr: 'الاستقبال عند الباب', titleEn: 'Welcome at the door', detailAr: 'يقف المضيف لاستقبالك. السلام ثم الترحيب والسؤال عن الأحوال، ولا حديث عمل قبل ذلك.', detailEn: 'The host stands to welcome you. Salaam, greetings and well-being first; no business yet.', rules: ['R-ARAB-001', 'R-ARAB-025'] },
  { x: 372, y: 214, icon: Handshake, titleAr: 'السلام على الجميع', titleEn: 'Greeting everyone', detailAr: 'تسلّم على الحاضرين واحداً واحداً بدءاً بالأكبر مقاماً أو بحسب عرف المجلس، ويقف الحاضرون للأكبر سناً.', detailEn: 'Greet each person in turn, starting with the most senior or per local custom; people stand for elders.', rules: ['R-ARAB-023'] },
  { x: 548, y: 150, icon: Armchair, titleAr: 'الجلوس حيث يُشار إليك', titleEn: 'Sit where you are shown', detailAr: 'ضيف الشرف قرب صدر المجلس إلى يمين المضيف. لا تجلس قبل أن يُشار إليك.', detailEn: "The guest of honor sits near the head of the majlis on the host's right. Wait to be shown your seat.", rules: ['R-ARAB-023', 'R-ARAB-024'] },
  { x: 640, y: 262, icon: Coffee, titleAr: 'القهوة والتمر', titleEn: 'Coffee and dates', detailAr: 'تأخذ الفنجان بيدك اليمنى وتقبل الأول على الأقل، وللاكتفاء تهزّ الفنجان برفق وتعيده.', detailEn: 'Take the cup with your right hand, accept at least the first, and shake it gently to say enough.', rules: ['R-ARAB-005', 'R-ARAB-003'] },
  { x: 548, y: 342, icon: MessagesSquare, titleAr: 'الحديث بعد الضيافة', titleEn: 'Conversation after hospitality', detailAr: 'تُبنى الثقة أولاً. يبدأ موضوع الزيارة بعد القهوة والحديث العام وبصبر.', detailEn: 'Trust comes first. The purpose of the visit comes after coffee and general conversation, patiently.', rules: ['R-ARAB-025'] },
  { x: 378, y: 366, icon: Utensils, titleAr: 'مائدة الضيافة', titleEn: 'The hospitality meal', detailAr: 'أطباق كبيرة مشتركة والمضيف يضع أفضل القطع أمامك. تعتذر عن المزيد بوضع يدك على صدرك.', detailEn: 'Large shared platters; the host places the best portions before you. Decline more with a hand on your heart.', rules: ['R-ARAB-028'] },
  { x: 214, y: 376, icon: Flame, titleAr: 'البخور والوداع', titleEn: 'Incense and farewell', detailAr: 'مرور البخور إشارة إلى قرب انتهاء الجلسة. تقبله ثم تستأذن بالانصراف مع شكر المضيف.', detailEn: 'Incense passing signals the gathering is ending. Accept it, then take leave, thanking the host.', rules: ['R-ARAB-027'] },
];

const DELEGATION: Station[] = [
  { x: 84, y: 90, icon: Plane, titleAr: 'الوصول وصالة الاستقبال', titleEn: 'Arrival and lounge', detailAr: 'منسّق المراسم ينتظر الوفد عند الباب بقائمة الأسماء كاملة وبألقابها الصحيحة.', detailEn: 'The protocol coordinator meets the delegation at the door with the full list of names and correct titles.', rules: ['R-ARAB-017', 'R-ARAB-032'] },
  { x: 214, y: 172, icon: Handshake, titleAr: 'الترحيب الرسمي', titleEn: 'Formal welcome', detailAr: 'تحية رسمية قصيرة وتعريف بالمرافق وإبلاغ الوفد بالبرنامج دون إطالة.', detailEn: 'A short formal greeting, an introduction to the liaison, and a brief outline of the programme.', rules: ['R-ARAB-001', 'R-ARAB-032'] },
  { x: 372, y: 98, icon: Car, titleAr: 'الانتقال', titleEn: 'Transfer', detailAr: 'السيارات مرتبة بحسب الأسبقية، ومرافق من الجهة المضيفة مع كل سيارة.', detailEn: 'Vehicles are ordered by precedence, with a host-side liaison in each car.', rules: ['R-ARAB-032'] },
  { x: 548, y: 142, icon: Building2, titleAr: 'الوصول إلى مقر الاجتماع', titleEn: 'Arrival at the venue', detailAr: 'ضيافة خفيفة ومصلّى مهيأ واستراحة قصيرة قبل الاجتماع.', detailEn: 'Light refreshments, a prepared prayer room and a short rest before the meeting.', rules: ['R-ARAB-007', 'R-ARAB-032'] },
  { x: 650, y: 252, icon: Users, titleAr: 'الاجتماع الرسمي', titleEn: 'The official meeting', detailAr: 'جلوس بحسب الأسبقية: المضيف أمام المدخل وضيف الشرف إلى يمينه.', detailEn: "Seating by precedence: the host faces the entrance, the chief guest on his right.", rules: ['R-ARAB-024'] },
  { x: 524, y: 350, icon: Utensils, titleAr: 'المأدبة', titleEn: 'The banquet', detailAr: 'مخطط الجلوس يُعتمد من مكتب المراسم، والقيود الغذائية تُحسم مسبقاً.', detailEn: 'The seating plan is approved by the protocol office and dietary needs are settled in advance.', rules: ['R-ARAB-024', 'R-ARAB-012'] },
  { x: 354, y: 362, icon: Gift, titleAr: 'تبادل الهدايا', titleEn: 'Gift exchange', detailAr: 'هدية مؤسسية رمزية تُقدَّم علناً بتنسيق مسبق مع مكتب المراسم.', detailEn: 'A symbolic institutional gift, presented openly and coordinated with the protocol office.', rules: ['R-ARAB-015', 'R-ARAB-014'] },
  { x: 188, y: 330, icon: Camera, titleAr: 'الصورة والوداع', titleEn: 'Photo and farewell', detailAr: 'الصورة التذكارية بإذن مسبق، ثم توديع الوفد عند الباب كما استُقبل.', detailEn: 'The commemorative photo with prior permission, then the delegation is seen off at the door as it was received.', rules: ['R-ARAB-022'] },
];

export const PATH_STATIONS: Record<PathVariant, Station[]> = { majlis: MAJLIS, delegation: DELEGATION };

/** Smooth Catmull-Rom spline through the stations, as a cubic Bezier path. */
export function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  const d: string[] = [`M${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x} ${p2.y}`);
  }
  return d.join(' ');
}

interface Props {
  variant: PathVariant;
  locale: string;
  className?: string;
  /** Start automatically (ignored under prefers-reduced-motion). */
  autoPlay?: boolean;
  onRuleClick?: (ruleId: string) => void;
}

const W = 800;
const H = 440;

export const ReceptionPath = forwardRef<SVGSVGElement, Props>(function ReceptionPath(
  { variant, locale, className, autoPlay = false, onRuleClick },
  ref,
) {
  const p = useSvgIds();
  const reduced = useReducedMotion();
  const stations = PATH_STATIONS[variant];
  const pathRef = useRef<SVGPathElement | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [len, setLen] = useState(0);
  const lenRef = useRef(0);
  const animRef = useRef(0);
  const [stationLens, setStationLens] = useState<number[]>([]);
  const [total, setTotal] = useState(1);
  const [marker, setMarker] = useState<{ x: number; y: number }>({ x: stations[0].x, y: stations[0].y });

  const d = useMemo(() => smoothPath(stations), [stations]);

  // Measure arc length of every station along the path once the path is in the DOM.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const L = path.getTotalLength();
    setTotal(L);
    const lens: number[] = [];
    let cursor = 0;
    for (const s of stations) {
      let best = cursor;
      let bestD = Infinity;
      for (let l = cursor; l <= L; l += 2) {
        const pt = path.getPointAtLength(l);
        const dd = Math.hypot(pt.x - s.x, pt.y - s.y);
        if (dd < bestD) {
          bestD = dd;
          best = l;
        }
      }
      lens.push(best);
      cursor = best;
    }
    setStationLens(lens);
    lenRef.current = lens[0] ?? 0;
    setLen(lens[0] ?? 0);
    setMarker({ x: stations[0].x, y: stations[0].y });
    setIdx(0);
    setPlaying(false);
  }, [stations, d]);

  const moveTo = useCallback(
    (to: number) => {
      const path = pathRef.current;
      if (!path || stationLens.length === 0) return;
      const target = Math.max(0, Math.min(stations.length - 1, to));
      cancelAnimationFrame(animRef.current);
      const from = lenRef.current;
      const dest = stationLens[target];
      const start = performance.now();
      const duration = reduced ? 0 : Math.max(500, Math.min(2200, Math.abs(dest - from) * 5));
      setIdx(target);
      if (duration === 0) {
        lenRef.current = dest;
        setLen(dest);
        const pt = path.getPointAtLength(dest);
        setMarker({ x: pt.x, y: pt.y });
        return;
      }
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const l = from + (dest - from) * eased;
        const pt = path.getPointAtLength(l);
        lenRef.current = l;
        setLen(l);
        setMarker({ x: pt.x, y: pt.y });
        if (t < 1) animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    },
    [reduced, stationLens, stations.length],
  );

  // Auto-advance while playing: dwell at each station, then glide to the next.
  useEffect(() => {
    if (!playing) return;
    if (idx >= stations.length - 1) {
      const t = setTimeout(() => setPlaying(false), 1800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => moveTo(idx + 1), 2600);
    return () => clearTimeout(t);
  }, [playing, idx, moveTo, stations.length]);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  useEffect(() => {
    if (autoPlay && !reduced && stationLens.length > 0) setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, stationLens.length]);

  const cur = stations[idx];
  const Icon = cur.icon;

  return (
    <div className={className}>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-2 sm:p-3 overflow-hidden">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={tr(locale, 'مسار الاستقبال', 'Reception path')} className="w-full h-auto select-none" style={{ direction: svgDir(locale) }}>
          <VisualDefs p={p} />
          <rect x="6" y="6" width={W - 12} height={H - 12} rx="22" fill={`url(#${p}-floor)`} stroke="var(--ink-3)" strokeWidth="2" />

          {variant === 'majlis' ? (
            <g>
              <rect x="20" y="236" width="250" height="180" rx="20" fill="var(--surface-2)" opacity="0.85" />
              <text x={locale === 'ar' ? 256 : 40} y="402" fontSize="14" fontWeight="700" fill="var(--ink-3)" textAnchor={anchorFor(locale, 'left')}>{tr(locale, 'الفناء والمدخل', 'Courtyard & entrance')}</text>
              <rect x="300" y="60" width="466" height="340" rx="26" fill="var(--surface)" stroke="var(--gold)" strokeWidth="2" strokeDasharray="1 8" strokeLinecap="round" />
              <rect x="340" y="92" width="380" height="146" rx="14" fill={`url(#${p}-rug)`} stroke="#e2c07a" strokeWidth="3" opacity="0.92" />
              <rect x="318" y="76" width="428" height="26" rx="12" fill={`url(#${p}-sofa)`} stroke="#c9b383" />
              <rect x="318" y="76" width="26" height="150" rx="12" fill={`url(#${p}-sofa)`} stroke="#c9b383" />
              <rect x="720" y="76" width="26" height="150" rx="12" fill={`url(#${p}-sofa)`} stroke="#c9b383" />
              <text x="533" y="66" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--gold-ink, var(--gold))">{tr(locale, 'صدر المجلس', 'Head of the majlis')}</text>
              <text x="533" y="394" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink-3)">{tr(locale, 'قاعة الضيافة', 'Dining hall')}</text>
              <circle cx="60" cy="270" r="20" fill="#0f766e" opacity="0.22" />
              <circle cx="60" cy="270" r="9" fill="#0f766e" opacity="0.5" />
              <circle cx="236" cy="410" r="14" fill="#0f766e" opacity="0.22" />
            </g>
          ) : (
            <g>
              <rect x="22" y="38" width="188" height="118" rx="18" fill="var(--surface-2)" opacity="0.9" />
              <text x={locale === 'ar' ? 196 : 38} y="62" fontSize="14" fontWeight="700" fill="var(--ink-3)" textAnchor={anchorFor(locale, 'left')}>{tr(locale, 'المطار / الوصول', 'Airport / arrival')}</text>
              <path d="M210 140 C 290 130 310 90 380 96" fill="none" stroke="var(--ink-3)" strokeWidth="22" strokeLinecap="round" opacity="0.14" />
              <rect x="470" y="86" width="312" height="300" rx="26" fill="var(--surface)" stroke="var(--gold)" strokeWidth="2" strokeDasharray="1 8" strokeLinecap="round" />
              <text x="626" y="112" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--gold-ink, var(--gold))">{tr(locale, 'مقر الاجتماع', 'Meeting venue')}</text>
              <rect x="560" y="200" width="150" height="104" rx="52" fill={`url(#${p}-wood)`} opacity="0.92" />
              <text x="635" y="258" textAnchor="middle" fontSize="13" fontWeight="700" fill="#f6e7c1">{tr(locale, 'الاجتماع', 'Meeting')}</text>
            </g>
          )}

          {/* Route: faint full path, bright travelled part */}
          <path ref={pathRef} d={d} fill="none" stroke="var(--ink-3)" strokeWidth="5" strokeDasharray="2 12" strokeLinecap="round" opacity="0.55" />
          <path d={d} fill="none" stroke="var(--gold)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${len} ${total + 10}`} />

          {stations.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <g
                key={i}
                role="button"
                tabIndex={0}
                aria-label={`${i + 1}. ${tr(locale, s.titleAr, s.titleEn)}`}
                onClick={() => {
                  setPlaying(false);
                  moveTo(i);
                }}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setPlaying(false), moveTo(i))}
                className="cursor-pointer outline-none"
              >
                {active && <circle cx={s.x} cy={s.y} r="30" fill="var(--gold)" opacity="0.22" />}
                <circle cx={s.x} cy={s.y} r="22" fill={active ? '#0f1b33' : done ? '#cfae6a' : 'var(--surface)'} stroke={active ? '#e2c07a' : 'var(--ink-3)'} strokeWidth="2.2" />
                <s.icon x={s.x - 11} y={s.y - 11} width={22} height={22} stroke={active ? '#f6e7c1' : done ? '#14213d' : 'var(--ink-2)'} strokeWidth={2} />
                <circle cx={s.x + 17} cy={s.y - 17} r="10" fill={active ? '#e2c07a' : 'var(--bg)'} stroke="var(--gold)" strokeWidth="1.4" />
                <text x={s.x + 17} y={s.y - 12.5} textAnchor="middle" fontSize="12" fontWeight="800" fill={active ? '#14213d' : 'var(--ink)'}>{i + 1}</text>
              </g>
            );
          })}

          {/* The guest */}
          <g transform={`translate(${marker.x} ${marker.y - 40})`} pointerEvents="none">
            <path d="M0 34 L-10 14 H10 Z" fill="#e2c07a" />
            <circle r="15" cy="0" fill="#e2c07a" stroke="#0f1b33" strokeWidth="2.2" />
            <circle r="5" cx="0" cy="-2" fill="#0f1b33" />
            <path d="M-8 9 q8 6 16 0" stroke="#0f1b33" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] items-start">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-[var(--primary)] text-[var(--bg)] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--gold-ink)] tabular-nums">
                {tr(locale, 'المحطة', 'Step')} {idx + 1} / {stations.length}
              </p>
              <h3 className="text-base font-bold text-[var(--ink)]">{tr(locale, cur.titleAr, cur.titleEn)}</h3>
            </div>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--ink-2)]">{tr(locale, cur.detailAr, cur.detailEn)}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {cur.rules.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRuleClick?.(r)}
                className="font-mono text-[11px] rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                dir="ltr"
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex sm:flex-col items-center gap-2" role="group" aria-label={tr(locale, 'التحكم بالمسار', 'Path controls')}>
          <button type="button" onClick={() => { setPlaying(false); moveTo(idx - 1); }} disabled={idx === 0} className="w-11 h-11 rounded-full border border-[var(--line)] bg-[var(--surface)] flex items-center justify-center disabled:opacity-40 cursor-pointer" aria-label={tr(locale, 'السابق', 'Previous')}>
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!playing && idx >= stations.length - 1) moveTo(0);
              setPlaying((v) => !v);
            }}
            className="w-14 h-14 rounded-full bg-[var(--primary)] text-[var(--bg)] flex items-center justify-center cursor-pointer shadow-sm"
            aria-label={playing ? tr(locale, 'إيقاف مؤقت', 'Pause') : tr(locale, 'تشغيل', 'Play')}
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button type="button" onClick={() => { setPlaying(false); moveTo(idx + 1); }} disabled={idx >= stations.length - 1} className="w-11 h-11 rounded-full border border-[var(--line)] bg-[var(--surface)] flex items-center justify-center disabled:opacity-40 cursor-pointer" aria-label={tr(locale, 'التالي', 'Next')}>
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
