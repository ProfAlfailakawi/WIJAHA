import React, { forwardRef } from 'react';
import { Camera } from 'lucide-react';
import { Chair, FurnitureView, PersonDisc, svgDir, tr, useSvgIds, VisualDefs } from './svg-kit.tsx';

export type PodiumScene = 'signing' | 'stage' | 'photo';

export const SCENE_NAMES: Record<PodiumScene, { ar: string; en: string }> = {
  signing: { ar: 'توقيع اتفاقية', en: 'Signing ceremony' },
  stage: { ar: 'منصة كلمة', en: 'Speech stage' },
  photo: { ar: 'الصورة التذكارية', en: 'Group photo' },
};

const COPY: Record<PodiumScene, { ar: string; en: string; rule: string; points: Array<[string, string]> }> = {
  signing: {
    ar: 'يجلس الرئيسان في وسط الطاولة، كلٌّ أمام علم بلاده، ويقف المرافقون خلفهما بالتناوب بحسب الأسبقية.',
    en: 'The two principals sit at the centre of the table, each before their own flag, with aides standing behind them alternately by rank.',
    rule: 'R-ARAB-024',
    points: [
      ['ضيف الشرف إلى يمين المضيف', "The guest of honor sits on the host's right"],
      ['الأعلام خلف كل طرف بارتفاع متساوٍ', 'Flags behind each side at equal height'],
      ['الأقلام والمجلدات متطابقة ومرتبة قبل الحضور', 'Identical pens and folders, set before arrival'],
    ],
  },
  stage: {
    ar: 'المنصة في الوسط والأعلام على جانبيها، وصف الضيوف الأول للأعلى مقاماً، وضيف الشرف في الصف الأول إلى يمين المضيف.',
    en: 'The podium stands at the centre with flags on either side; the front row is for the most senior guests, with the guest of honor on the host\'s right.',
    rule: 'R-ARAB-024',
    points: [
      ['مقاعد محجوزة ببطاقات أسماء في الصف الأول', 'Front row reserved with name cards'],
      ['ممر واضح للمتحدث من المدخل إلى المنصة', 'A clear path for the speaker from the entrance to the podium'],
      ['مترجم فوري بموضع لا يحجب الرؤية', 'Interpreter positioned without blocking the view'],
    ],
  },
  photo: {
    ar: 'الرئيسان في وسط الصف الأول، ثم يتناوب الباقون يميناً ويساراً بحسب الأسبقية، والصف الثاني واقف خلفهم.',
    en: 'The principals sit at the centre of the front row; the others alternate right and left by rank, with a standing second row behind.',
    rule: 'R-ARAB-022',
    points: [
      ['تُؤخذ الموافقة على التصوير والنشر مسبقاً', 'Permission to photograph and publish is obtained in advance'],
      ['الأعلام خلف الرئيسين تماماً', 'Flags directly behind the two principals'],
      ['مصوّر واحد معتمد ومكان محدد له', 'One approved photographer with a marked position'],
    ],
  },
};

const NOTE = {
  ar: 'رسم توضيحي للمبدأ العام: الأعلام مجرّدة، وتُعتمد التفاصيل الدقيقة من مراسم الجهة المضيفة.',
  en: "An illustration of the general principle: the flags are abstract, and exact details are confirmed by the host's protocol office.",
};

/** Abstract flag (never a real national flag) on a pole. */
function Flag({ x, y, h = 150, kind, p, scale = 1 }: { x: number; y: number; h?: number; kind: 'host' | 'guest'; p: string; scale?: number }) {
  const w = 96 * scale;
  const fh = 62 * scale;
  return (
    <g>
      <rect x={x - 2.5} y={y} width="5" height={h} rx="2.5" fill="#a8834a" />
      <circle cx={x} cy={y} r="5.5" fill="#e2c07a" />
      <g transform={`translate(${x + 3} ${y + 6})`} filter={`url(#${p}-soft)`}>
        {kind === 'host' ? (
          <>
            <path d={`M0 0Q${w * 0.25} -8 ${w * 0.5} 0T${w} 0V${fh}Q${w * 0.75} ${fh + 8} ${w * 0.5} ${fh}T0 ${fh}Z`} fill="#0f1b33" />
            <path d={`M0 ${fh * 0.7}H${w}V${fh}Q${w * 0.75} ${fh + 8} ${w * 0.5} ${fh}T0 ${fh}Z`} fill="#a8834a" />
            <path d={`M${w * 0.5} ${fh * 0.16}l${w * 0.12} ${fh * 0.22}l-${w * 0.12} ${fh * 0.22}l-${w * 0.12} -${fh * 0.22}z`} fill="#e2c07a" />
          </>
        ) : (
          <>
            <path d={`M0 0Q${w * 0.25} -8 ${w * 0.5} 0T${w} 0V${fh}Q${w * 0.75} ${fh + 8} ${w * 0.5} ${fh}T0 ${fh}Z`} fill="#0f766e" />
            <path d={`M0 ${fh * 0.34}H${w}V${fh * 0.66}H0Z`} fill="#fffdf8" opacity="0.95" />
            <circle cx={w * 0.5} cy={fh * 0.5} r={fh * 0.17} fill="#e2c07a" />
          </>
        )}
      </g>
    </g>
  );
}

/** Abstract front-view person (no skin tones): shoulders, head and a rank badge. */
function Bust({ x, y, rank, tone, s = 1, p }: { x: number; y: number; rank?: number; tone: 'host' | 'chief' | 'guest' | 'aide'; s?: number; p: string }) {
  const body = tone === 'host' ? '#0f1b33' : tone === 'chief' ? '#0f766e' : tone === 'aide' ? '#6b7a99' : '#b79a63';
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} filter={`url(#${p}-soft)`}>
      <path d="M-34 52Q-34 6 0 6Q34 6 34 52Z" fill={body} />
      <path d="M-8 6L0 22L8 6" fill="#fffdf8" opacity="0.9" />
      <circle cx="0" cy="-14" r="16" fill="#efe3c8" stroke={body} strokeWidth="3" />
      {rank !== undefined && (
        <g>
          <circle cx="0" cy="38" r="11" fill="#e2c07a" stroke="#0f1b33" strokeWidth="1.4" />
          <text x="0" y="42.5" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#14213d">{rank}</text>
        </g>
      )}
    </g>
  );
}

interface Props {
  scene: PodiumScene;
  locale: string;
  className?: string;
  onRuleClick?: (id: string) => void;
}

export const PodiumFlags = forwardRef<SVGSVGElement, Props>(function PodiumFlags({ scene, locale, className, onRuleClick }, ref) {
  const p = useSvgIds();
  const copy = COPY[scene];

  return (
    <div className={className}>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-2 sm:p-3 overflow-hidden">
        <svg ref={ref} viewBox="0 0 800 470" role="img" aria-label={tr(locale, SCENE_NAMES[scene].ar, SCENE_NAMES[scene].en)} className="w-full h-auto select-none" style={{ direction: svgDir(locale) }}>
          <VisualDefs p={p} />
          <rect x="6" y="6" width="788" height="458" rx="24" fill="var(--surface-2)" stroke="var(--ink-3)" strokeWidth="2" />

          {scene === 'signing' && (
            <g>
              <rect x="40" y="36" width="720" height="250" rx="16" fill={`url(#${p}-stage)`} />
              <rect x="52" y="48" width="696" height="226" rx="10" fill="none" stroke="#e2c07a" strokeWidth="1.2" opacity="0.7" />
              <Flag x={250} y={70} h={216} kind="guest" p={p} />
              <Flag x={546} y={70} h={216} kind="host" p={p} />
              {/* standing aides behind the principals */}
              <Bust x={168} y={196} rank={4} tone="aide" s={0.8} p={p} />
              <Bust x={632} y={196} rank={3} tone="aide" s={0.8} p={p} />
              <Bust x={400} y={190} rank={5} tone="aide" s={0.8} p={p} />
              {/* seated principals */}
              <Bust x={316} y={236} rank={2} tone="chief" s={1.15} p={p} />
              <Bust x={484} y={236} rank={1} tone="host" s={1.15} p={p} />
              {/* table */}
              <g filter={`url(#${p}-shadow)`}>
                <rect x="150" y="320" width="500" height="64" rx="10" fill="#fffdf8" stroke="#e2c07a" strokeWidth="2" />
                <rect x="150" y="320" width="500" height="22" rx="10" fill="#f1e8d2" />
              </g>
              {[316, 484].map((px) => (
                <g key={px}>
                  <rect x={px - 34} y="332" width="68" height="42" rx="4" fill="#0f1b33" />
                  <rect x={px - 34} y="332" width="68" height="42" rx="4" fill="none" stroke="#e2c07a" strokeWidth="1.2" />
                  <rect x={px + 22} y="344" width="26" height="4" rx="2" fill="#a8834a" transform={`rotate(-18 ${px + 22} 346)`} />
                </g>
              ))}
              <text x="316" y="414" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink-2)">{tr(locale, 'ضيف الشرف · يمين المضيف', "Guest of honor · host's right")}</text>
              <text x="484" y="414" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink-2)">{tr(locale, 'المضيف', 'Host')}</text>
              <text x="298" y="62" textAnchor="middle" fontSize="13" fontWeight="700" fill="#f6e7c1">{tr(locale, 'علم الضيف', "Guest's flag")}</text>
              <text x="594" y="62" textAnchor="middle" fontSize="13" fontWeight="700" fill="#f6e7c1">{tr(locale, 'علم المضيف', "Host's flag")}</text>
              <g transform="translate(400 448)">
                <circle r="15" fill="var(--primary)" />
                <Camera x={-8} y={-8} width={16} height={16} stroke="var(--bg)" strokeWidth={2} />
              </g>
            </g>
          )}

          {scene === 'stage' && (
            <g>
              <FurnitureView f={{ kind: 'rrect', x: 120, y: 28, w: 560, h: 124, r: 16, tone: 'stage' }} p={p} />
              <text x="400" y="52" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#e2c07a">{tr(locale, 'خلفية المنصة', 'Stage backdrop')}</text>
              <FurnitureView f={{ kind: 'podium', x: 400, y: 104 }} p={p} />
              <Flag x={196} y={44} h={96} kind="guest" p={p} scale={0.8} />
              <Flag x={600} y={44} h={96} kind="host" p={p} scale={0.8} />
              <text x="196" y="172" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--ink-2)">{tr(locale, 'علم الضيف', "Guest's flag")}</text>
              <text x="636" y="172" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--ink-2)">{tr(locale, 'علم المضيف', "Host's flag")}</text>
              {/* audience rows */}
              {[0, 1, 2].map((row) =>
                Array.from({ length: row === 0 ? 6 : 8 }, (_, i) => {
                  const n = row === 0 ? 6 : 8;
                  const x = 400 + (i - (n - 1) / 2) * (row === 0 ? 74 : 70);
                  const y = 236 + row * 66;
                  // Front row: ranks alternate from the centre, the host's right (screen-left) first.
                  const rank = row === 0 ? [4, 2, 1, 3, 5, 6][i] : undefined;
                  const tone = rank === 1 ? 'host' : rank === 2 ? 'chief' : 'guest';
                  return (
                    <g key={`${row}-${i}`}>
                      <Chair x={x} y={y} facing={270} tone={tone} p={p} />
                      {row === 0 && <PersonDisc x={x} y={y} rank={rank ?? ''} tone={tone} p={p} r={13} />}
                    </g>
                  );
                }),
              )}
              <text x="400" y="438" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="var(--ink-2)">{tr(locale, 'الصف الأول محجوز بالأسبقية', 'Front row reserved by precedence')}</text>
            </g>
          )}

          {scene === 'photo' && (
            <g>
              <rect x="40" y="30" width="720" height="290" rx="16" fill={`url(#${p}-stage)`} />
              <Flag x={330} y={52} h={256} kind="guest" p={p} />
              <Flag x={470} y={52} h={256} kind="host" p={p} />
              {/* back row (standing) */}
              {[6, 7, 8, 9, 10, 11].map((rank, i) => (
                <Bust key={rank} x={150 + i * 100} y={184} rank={rank} tone="aide" s={0.78} p={p} />
              ))}
              {/* front row (seated), principals in the centre */}
              {[
                { rank: 4, x: 160 },
                { rank: 2, x: 290 },
                { rank: 1, x: 400 },
                { rank: 3, x: 510 },
                { rank: 5, x: 640 },
              ].map((b) => (
                <Bust key={b.rank} x={b.x} y={236} rank={b.rank} tone={b.rank === 1 ? 'host' : b.rank === 2 ? 'chief' : 'guest'} s={b.rank <= 2 ? 1.12 : 1} p={p} />
              ))}
              <rect x="120" y="334" width="560" height="14" rx="7" fill="#a8834a" opacity="0.55" />
              <path d="M400 440L170 340M400 440L630 340" stroke="var(--gold)" strokeWidth="2" strokeDasharray="4 7" opacity="0.8" />
              <g transform="translate(400 442)">
                <circle r="19" fill="var(--primary)" />
                <Camera x={-10} y={-10} width={20} height={20} stroke="var(--bg)" strokeWidth={2} />
              </g>
              <text x="400" y="352" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink-2)">{tr(locale, 'الصف الأول: الرئيسان في الوسط', 'Front row: principals in the centre')}</text>
              <text x="560" y="446" fontSize="13.5" fontWeight="700" fill="var(--ink-2)">{tr(locale, 'المصوّر', 'Photographer')}</text>
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-sm leading-relaxed text-[var(--ink-2)]">{tr(locale, copy.ar, copy.en)}</p>
        <ul className="mt-2.5 space-y-1.5">
          {copy.points.map(([ar, en], i) => (
            <li key={i} className="text-sm text-[var(--ink)] flex gap-2">
              <span className="text-[var(--gold)]" aria-hidden="true">◆</span>
              <span>{tr(locale, ar, en)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => onRuleClick?.(copy.rule)} className="font-mono text-[11px] rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer" dir="ltr">
            {copy.rule}
          </button>
          <span className="text-xs text-[var(--ink-3)]">{tr(locale, NOTE.ar, NOTE.en)}</span>
        </div>
      </div>
    </div>
  );
});
