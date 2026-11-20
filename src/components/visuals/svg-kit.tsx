import React, { useId } from 'react';
import type { Furniture } from '../../shared/visuals/seating.ts';

/** Shared drawing primitives for every WIJAHA visual: warm woods, navy leather, gold piping, soft shadows. */

export type Tone = 'host' | 'chief' | 'guest' | 'aide';

export const TONE_FILL: Record<Tone, { a: string; b: string; ink: string }> = {
  host: { a: '#22345f', b: '#0c1630', ink: '#f6e7c1' },
  chief: { a: '#e2c07a', b: '#a8834a', ink: '#14213d' },
  guest: { a: '#fffdf8', b: '#e9dfca', ink: '#0f1b33' },
  aide: { a: '#2aa597', b: '#0f766e', ink: '#ffffff' },
};

export function useSvgIds(): string {
  // useId() yields ":r1:"; colons are unsafe inside url(#...) once the SVG is serialized.
  return 'v' + useId().replace(/[^a-zA-Z0-9]/g, '');
}

export function VisualDefs({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}-wood`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#a8723c" />
        <stop offset="0.5" stopColor="#7a4d26" />
        <stop offset="1" stopColor="#5b3716" />
      </linearGradient>
      <linearGradient id={`${p}-sofa`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f8f1e1" />
        <stop offset="1" stopColor="#e1d3b4" />
      </linearGradient>
      <linearGradient id={`${p}-stage`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#22345f" />
        <stop offset="1" stopColor="#0f1b33" />
      </linearGradient>
      {(['host', 'chief', 'guest', 'aide'] as Tone[]).map((t) => (
        <linearGradient id={`${p}-${t}`} key={t} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={TONE_FILL[t].a} />
          <stop offset="1" stopColor={TONE_FILL[t].b} />
        </linearGradient>
      ))}
      <radialGradient id={`${p}-sheen`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <pattern id={`${p}-floor`} width="44" height="44" patternUnits="userSpaceOnUse">
        <rect width="44" height="44" fill="var(--surface)" />
        <path d="M22 0V44M0 22H44" stroke="var(--line)" strokeWidth="0.6" opacity="0.55" />
        <path d="M22 15l7 7-7 7-7-7z" fill="none" stroke="var(--line)" strokeWidth="0.6" opacity="0.7" />
      </pattern>
      <pattern id={`${p}-rug`} width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="34" height="34" fill="#8f2f2a" opacity="0.9" />
        <rect x="4" y="4" width="26" height="26" fill="none" stroke="#e2c07a" strokeWidth="1.1" opacity="0.7" />
        <rect x="11" y="11" width="12" height="12" fill="none" stroke="#e2c07a" strokeWidth="1" opacity="0.55" />
        <circle cx="17" cy="17" r="2.6" fill="#e2c07a" opacity="0.8" />
      </pattern>
      <filter id={`${p}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="4.5" floodColor="#0f1b33" floodOpacity="0.28" />
      </filter>
      <filter id={`${p}-soft`} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f1b33" floodOpacity="0.22" />
      </filter>
    </defs>
  );
}

/** Room frame with a tiled floor. */
export function Room({ p, w, h }: { p: string; w: number; h: number }) {
  return (
    <g>
      <rect x="10" y="10" width={w - 20} height={h - 20} rx="22" fill={`url(#${p}-floor)`} stroke="var(--ink-3)" strokeWidth="2.2" />
      <rect x="22" y="22" width={w - 44} height={h - 44} rx="14" fill="none" stroke="var(--gold)" strokeWidth="1" strokeDasharray="2 7" opacity="0.65" />
    </g>
  );
}

export function Door({ x, y, w = 110, label, locale = 'ar' }: { x: number; y: number; w?: number; label: string; locale?: string }) {
  const half = w / 2;
  return (
    <g>
      <rect x={x - half} y={y - 14} width={w} height="14" fill="var(--bg)" />
      <path d={`M${x - half} ${y - 8}A${w * 0.6} ${w * 0.6} 0 0 1 ${x - half + w * 0.38} ${y - 8 - w * 0.46}`} fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="4 4" />
      <line x1={x - half} y1={y - 8} x2={x - half + w * 0.38} y2={y - 8 - w * 0.46} stroke="var(--ink-2)" strokeWidth="3" strokeLinecap="round" />
      <line x1={x - half} y1={y - 8} x2={x + half} y2={y - 8} stroke="var(--gold)" strokeWidth="4" strokeLinecap="round" />
      <text x={x + half + 12} y={y - 12} fontSize="15" fontWeight="600" fill="var(--ink-2)" textAnchor={anchorFor(locale, 'left')}>
        {label}
      </text>
    </g>
  );
}

/** A top-down chair: seat cushion + backrest, designed facing south then rotated. */
export function Chair({ x, y, facing, tone, p }: { x: number; y: number; facing: number; tone: Tone; p: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${facing - 90})`} filter={`url(#${p}-soft)`}>
      <rect x="-16" y="-24" width="32" height="10" rx="5" fill="#3b2a1c" />
      <rect x="-17" y="-17" width="34" height="34" rx="11" fill="#5b3716" />
      <rect x="-14.5" y="-14.5" width="29" height="29" rx="9" fill={tone === 'guest' ? '#243a69' : `url(#${p}-${tone})`} />
      <rect x="-14.5" y="-14.5" width="29" height="29" rx="9" fill={`url(#${p}-sheen)`} />
    </g>
  );
}

export function PersonDisc({
  x,
  y,
  rank,
  tone,
  selected,
  p,
  r = 15,
}: {
  x: number;
  y: number;
  rank: number | string;
  tone: Tone;
  selected?: boolean;
  p: string;
  r?: number;
}) {
  return (
    <g>
      {selected && <circle cx={x} cy={y} r={r + 8} fill="none" stroke="var(--gold)" strokeWidth="2.4" strokeDasharray="5 4" />}
      <circle cx={x} cy={y} r={r} fill={`url(#${p}-${tone})`} stroke={tone === 'guest' ? '#0f1b33' : 'none'} strokeWidth="1.4" filter={`url(#${p}-soft)`} />
      <circle cx={x} cy={y} r={r} fill={`url(#${p}-sheen)`} />
      <text x={x} y={y + 5.5} textAnchor="middle" fontSize="15.5" fontWeight="800" fill={TONE_FILL[tone].ink} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {rank}
      </text>
    </g>
  );
}

export function FurnitureView({ f, p }: { f: Furniture; p: string }) {
  switch (f.kind) {
    case 'ellipse':
      return (
        <g filter={`url(#${p}-shadow)`}>
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill={`url(#${p}-wood)`} />
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx - 10} ry={f.ry - 10} fill="none" stroke="#e2c07a" strokeWidth="1.4" opacity="0.7" />
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx - 28} ry={f.ry - 28} fill="none" stroke="#e2c07a" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.55" />
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill={`url(#${p}-sheen)`} />
        </g>
      );
    case 'rrect': {
      if (f.tone === 'rug') {
        return (
          <g>
            <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${p}-rug)`} stroke="#e2c07a" strokeWidth="3" />
            <rect x={f.x + 14} y={f.y + 14} width={f.w - 28} height={f.h - 28} rx={f.r} fill="none" stroke="#e2c07a" strokeWidth="1.4" opacity="0.85" />
          </g>
        );
      }
      if (f.tone === 'sofa') {
        return (
          <g filter={`url(#${p}-soft)`}>
            <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${p}-sofa)`} stroke="#c9b383" strokeWidth="1.4" />
            <rect x={f.x + 6} y={f.y + 6} width={f.w - 12} height={f.h - 12} rx={f.r - 4} fill="none" stroke="#e2c07a" strokeWidth="1.1" opacity="0.9" />
          </g>
        );
      }
      if (f.tone === 'stage') {
        return (
          <g filter={`url(#${p}-shadow)`}>
            <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${p}-stage)`} />
            <rect x={f.x + 8} y={f.y + 8} width={f.w - 16} height={f.h - 16} rx={f.r - 4} fill="none" stroke="#e2c07a" strokeWidth="1.2" opacity="0.8" />
          </g>
        );
      }
      if (f.tone === 'low') {
        return (
          <g filter={`url(#${p}-soft)`}>
            <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${p}-wood)`} />
            <rect x={f.x + 6} y={f.y + 6} width={f.w - 12} height={f.h - 12} rx={f.r - 4} fill="none" stroke="#e2c07a" strokeWidth="1" opacity="0.7" />
          </g>
        );
      }
      return (
        <g filter={`url(#${p}-shadow)`}>
          <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${p}-wood)`} />
          <rect x={f.x + 10} y={f.y + 10} width={f.w - 20} height={f.h - 20} rx={f.r - 4} fill="none" stroke="#e2c07a" strokeWidth="1.3" opacity="0.7" />
          <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${p}-sheen)`} />
        </g>
      );
    }
    case 'podium':
      return (
        <g filter={`url(#${p}-soft)`}>
          <rect x={f.x - 24} y={f.y - 18} width="48" height="34" rx="6" fill="#e2c07a" stroke="#a8834a" strokeWidth="1.4" />
          <rect x={f.x - 6} y={f.y - 30} width="12" height="14" rx="3" fill="#0f1b33" />
          <circle cx={f.x} cy={f.y - 33} r="3.6" fill="#e2c07a" />
        </g>
      );
    case 'brazier':
      return (
        <g filter={`url(#${p}-soft)`}>
          <circle cx={f.x} cy={f.y} r="17" fill="#3b2a1c" stroke="#e2c07a" strokeWidth="2" />
          <circle cx={f.x} cy={f.y} r="9" fill="#d97706" opacity="0.9" />
          <path d={`M${f.x} ${f.y - 12}c-8 -10 8 -16 0 -26M${f.x + 6} ${f.y - 10}c-6 -8 6 -14 0 -22`} stroke="var(--ink-3)" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case 'coffee':
      return (
        <g transform={`translate(${f.x} ${f.y})`} filter={`url(#${p}-soft)`}>
          <ellipse cx="0" cy="6" rx="44" ry="21" fill="#fffdf8" stroke="#e2c07a" strokeWidth="1.8" />
          <path d="M-15 12Q-20 -4 -9 -14L-6.5 -23Q0 -29 6.5 -23L9 -14Q20 -4 15 12Z" fill="#cfae6a" stroke="#a8834a" strokeWidth="1.4" />
          <path d="M-12 -4Q0 2 12 -4" stroke="#a8834a" strokeWidth="1.2" fill="none" />
          <path d="M13 -6Q30 -12 33 -28" stroke="#cfae6a" strokeWidth="4.2" fill="none" strokeLinecap="round" />
          <path d="M-13 -8Q-30 -6 -24 10" stroke="#a8834a" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <circle cx="0" cy="-30" r="3.4" fill="#a8834a" />
          {[-30, 26].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="12" r="5.6" fill="#fffdf8" stroke="#a8834a" strokeWidth="1.2" />
              <circle cx={cx} cy="12" r="2.8" fill="#5b3716" />
            </g>
          ))}
        </g>
      );
  }
}

/** Explicit text direction for every visual SVG (never inherited from the page, so exports match the screen). */
export const svgDir = (locale: string): 'rtl' | 'ltr' => (locale === 'ar' ? 'rtl' : 'ltr');

/**
 * SVG's text-anchor follows the inline direction: in RTL, "start" is the right edge.
 * `side` is the physical edge the text should hug.
 */
export const anchorFor = (locale: string, side: 'left' | 'right'): 'start' | 'end' =>
  (locale === 'ar') === (side === 'left') ? 'end' : 'start';

/** Small bilingual helper used across the visual components. */
export const tr = (locale: string, ar: string, en: string): string => (locale === 'ar' ? ar : en);

/** Wraps text into lines that fit a pixel width, using the supplied measuring function (pure and testable). */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 99): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (measure(next) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s،,.;:]+$/, '')}…`;
    return kept;
  }
  return lines;
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** Real text measurement in the browser; falls back to a width estimate (used in tests / SSR). */
export function makeMeasure(font: string): (s: string) => number {
  if (typeof document !== 'undefined') {
    measureCtx = measureCtx ?? document.createElement('canvas').getContext('2d');
    if (measureCtx) {
      const ctx = measureCtx;
      return (s) => {
        ctx.font = font;
        return ctx.measureText(s).width;
      };
    }
  }
  const px = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
  return (s) => s.length * px * 0.55;
}

export function ExportFrame({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
