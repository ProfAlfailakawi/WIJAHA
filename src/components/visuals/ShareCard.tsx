import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { makeMeasure, svgDir, useSvgIds, wrapText } from './svg-kit.tsx';

export type CardAccent = 'gold' | 'teal' | 'rose' | 'indigo';

export const ACCENTS: Record<CardAccent, { main: string; soft: string; ink: string; name: { ar: string; en: string } }> = {
  gold: { main: '#e2c07a', soft: '#f6e7c1', ink: '#14213d', name: { ar: 'ذهبي', en: 'Gold' } },
  teal: { main: '#5eead4', soft: '#d6faf3', ink: '#06302c', name: { ar: 'فيروزي', en: 'Teal' } },
  rose: { main: '#f5a097', soft: '#fde3df', ink: '#3a120e', name: { ar: 'وردي', en: 'Rose' } },
  indigo: { main: '#a5b4fc', soft: '#e3e8ff', ink: '#14193d', name: { ar: 'نيلي', en: 'Indigo' } },
};

export const CARD_W = 1080;
export const CARD_H = 1350;

export interface ShareCardProps {
  locale: string;
  kicker: string;
  title: string;
  points: string[];
  accent?: CardAccent;
  /** Small line under the points, e.g. "Advisory — confirm with the host's protocol office". */
  note?: string;
  className?: string;
}

const FONT = "Alexandria, 'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif";

/**
 * 4:5 social card. Text is wrapped manually (SVG has no auto-wrap) with real browser text measurement,
 * and the font size steps down until everything fits.
 */
export const ShareCard = forwardRef<SVGSVGElement, ShareCardProps>(function ShareCard(
  { locale, kicker, title, points, accent = 'gold', note, className },
  ref,
) {
  const p = useSvgIds();
  const rtl = locale === 'ar';
  // Text is measured with the real font, so re-layout once webfonts have loaded.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);
  const a = ACCENTS[accent];
  const margin = 84;
  const textLeft = rtl ? margin : margin + 96;
  const textRight = rtl ? CARD_W - margin - 96 : CARD_W - margin;
  const textW = textRight - textLeft;

  const layout = useMemo(() => {
    const all = points.filter((x) => x.trim()).slice(0, 5);
    const titleSize = 62;
    const titleLines = wrapText(title.trim() || (rtl ? 'عنوان البطاقة' : 'Card title'), CARD_W - margin * 2, makeMeasure(`800 ${titleSize}px ${FONT}`), 2);
    const top = 262 + titleLines.length * 80 + 22;
    const bottom = CARD_H - 196;
    const room = bottom - top;
    const gap = 16;
    // Fit by shrinking the type; if even the smallest size overflows, drop trailing points (keeping at least three).
    for (let count = all.length; count >= Math.min(3, all.length); count--) {
      const items = all.slice(0, count);
      for (const size of [44, 40, 36, 33, 30, 27, 24, 22]) {
        const measure = makeMeasure(`500 ${size}px ${FONT}`);
        const lineH = size * 1.5;
        const wrapped = items.map((t) => wrapText(t, textW * 0.94, measure, 3));
        const heights = wrapped.map((ls) => Math.max(96, ls.length * lineH + 44));
        const sum = heights.reduce((acc, h) => acc + h, 0) + gap * Math.max(0, items.length - 1);
        if (sum <= room) {
          // Spread any spare height evenly so the card never looks top-heavy.
          const extra = Math.min(36, (room - sum) / Math.max(1, items.length));
          let y = top;
          const cards = wrapped.map((lines, i) => {
            const h = heights[i] + extra;
            const card = { lines, y, h, size, lineH };
            y += h + gap;
            return card;
          });
          return { titleLines, titleSize, cards, top };
        }
      }
    }
    return { titleLines, titleSize, cards: [] as Array<{ lines: string[]; y: number; h: number; size: number; lineH: number }>, top };
  }, [points, title, textW, rtl, fontsReady]);

  const anchor = 'start' as const;
  const noteText = note || (rtl ? 'إرشادات استرشادية — تُؤكَّد التفاصيل مع مراسم الجهة المضيفة' : "Advisory guidance — confirm details with the host's protocol office");
  const noteLines = useMemo(() => wrapText(noteText, CARD_W - margin * 2, makeMeasure(`400 22px ${FONT}`), 2), [noteText, fontsReady]);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      role="img"
      aria-label={title}
      className={className ?? 'w-full h-auto'}
      style={{ fontFamily: FONT, direction: svgDir(locale) }}
    >
      <defs>
        <linearGradient id={`${p}-bg`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#0a1330" />
          <stop offset="0.55" stopColor="#15275a" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
        <radialGradient id={`${p}-glow`} cx="0.85" cy="0.1" r="0.7">
          <stop offset="0" stopColor={a.main} stopOpacity="0.38" />
          <stop offset="1" stopColor={a.main} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${p}-star`} width="120" height="120" patternUnits="userSpaceOnUse">
          <path d="M60 14l14 32 32-14-14 32 32 14-32 14 14 32-32-14-14 32-14-32-32 14 14-32-32-14 32-14-14-32 32 14z" fill="none" stroke={a.main} strokeWidth="1.2" opacity="0.2" />
          <circle cx="60" cy="60" r="5" fill={a.main} opacity="0.22" />
        </pattern>
      </defs>
      <rect width={CARD_W} height={CARD_H} fill={`url(#${p}-bg)`} />
      <rect width={CARD_W} height={CARD_H} fill={`url(#${p}-star)`} />
      <rect width={CARD_W} height={CARD_H} fill={`url(#${p}-glow)`} />
      <rect x="30" y="30" width={CARD_W - 60} height={CARD_H - 60} rx="36" fill="none" stroke={a.main} strokeWidth="2" opacity="0.55" />

      {/* brand */}
      <g transform={`translate(${rtl ? CARD_W - margin : margin} 112)`}>
        <rect x={rtl ? -64 : 0} y="-44" width="64" height="64" rx="18" fill="none" stroke={a.main} strokeWidth="3" />
        <path d={`M${rtl ? -32 : 32} -34l20 20-20 20-20-20z`} fill={a.main} />
        <text x={rtl ? -84 : 84} y="-6" textAnchor={anchor} fontSize="44" fontWeight="800" fill="#ffffff">
          {rtl ? 'وجاهة' : 'WIJAHA'}
        </text>
        <text x={rtl ? -84 : 84} y="22" textAnchor={anchor} fontSize="19" letterSpacing="4" fill={a.soft} opacity="0.85">
          {rtl ? 'WIJAHA' : 'PROTOCOL & ETIQUETTE'}
        </text>
      </g>

      {/* kicker */}
      {(() => {
        const text = kicker || (rtl ? 'دليل سريع' : 'Quick guide');
        const w = Math.min(CARD_W - margin * 2, text.length * 22 + 70);
        const x = rtl ? CARD_W - margin - w : margin;
        return (
          <g>
            <rect x={x} y="190" width={w} height="56" rx="28" fill={a.main} />
            <text x={x + w / 2} y="228" textAnchor="middle" fontSize="27" fontWeight="800" fill={a.ink}>
              {text}
            </text>
          </g>
        );
      })()}

      {/* title */}
      {layout.titleLines.map((line, i) => (
        <text key={i} x={rtl ? CARD_W - margin : margin} y={324 + i * 80} textAnchor={anchor} fontSize={layout.titleSize} fontWeight="800" fill="#ffffff">
          {line}
        </text>
      ))}

      {/* numbered points */}
      {layout.cards.map((c, i) => {
        const numX = rtl ? CARD_W - margin - 38 : margin + 38;
        return (
          <g key={i}>
            <rect x={margin} y={c.y} width={CARD_W - margin * 2} height={c.h} rx="26" fill="#ffffff" opacity="0.1" stroke={a.main} strokeOpacity="0.35" strokeWidth="1.5" />
            <circle cx={numX} cy={c.y + c.h / 2} r="30" fill={a.main} />
            <text x={numX} y={c.y + c.h / 2 + 12} textAnchor="middle" fontSize="34" fontWeight="800" fill={a.ink}>
              {i + 1}
            </text>
            {c.lines.map((line, li) => (
              <text
                key={li}
                x={rtl ? CARD_W - margin - 96 : margin + 96}
                y={c.y + 20 + c.size * 1.05 + li * c.lineH + (c.h - 40 - c.lines.length * c.lineH) / 2}
                textAnchor={anchor}
                fontSize={c.size}
                fontWeight="500"
                fill="#ffffff"
               
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}

      {/* footer */}
      <line x1={margin} y1={CARD_H - 168} x2={CARD_W - margin} y2={CARD_H - 168} stroke={a.main} strokeOpacity="0.5" strokeWidth="1.5" />
      {noteLines.map((line, i) => (
        <text key={i} x={rtl ? CARD_W - margin : margin} y={CARD_H - 128 + i * 30} textAnchor="start" fontSize="22" fill={a.soft} opacity="0.9">
          {line}
        </text>
      ))}
      <text x={margin} y={CARD_H - 56} textAnchor="start" fontSize="28" fontWeight="700" fill={a.main} style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}>
        wijaha.web.app
      </text>
    </svg>
  );
});
