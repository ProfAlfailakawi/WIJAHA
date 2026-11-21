import React, { forwardRef } from 'react';
import { tr } from './svg-kit.tsx';

export interface CardPerson {
  rank: number;
  name: string;
  title: string;
}

export const CARDS_PER_PAGE = 8;
export const PAGE_W = 794;
export const PAGE_H = 1123;

const isArabic = (s: string) => /[؀-ۿ]/.test(s);
const FONT = "Alexandria, 'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif";

function Face({ person, cx, cy, w, h, locale }: { person: CardPerson; cx: number; cy: number; w: number; h: number; locale: string }) {
  const name = person.name.length > 26 ? `${person.name.slice(0, 25)}…` : person.name;
  const title = person.title.length > 40 ? `${person.title.slice(0, 39)}…` : person.title;
  const dirName = isArabic(name) ? 'rtl' : 'ltr';
  const dirTitle = isArabic(title) ? 'rtl' : 'ltr';
  return (
    <g>
      <text x={cx} y={cy - h * 0.08} textAnchor="middle" fontSize={name.length > 18 ? 25 : 31} fontWeight="800" fill="#0f1b33" style={{ direction: dirName, unicodeBidi: 'plaintext' }}>
        {name}
      </text>
      {title && (
        <text x={cx} y={cy + h * 0.1} textAnchor="middle" fontSize="17" fill="#4a5470" style={{ direction: dirTitle, unicodeBidi: 'plaintext' }}>
          {title}
        </text>
      )}
      <line x1={cx - w * 0.22} y1={cy + h * 0.2} x2={cx + w * 0.22} y2={cy + h * 0.2} stroke="#cfae6a" strokeWidth="1.6" />
      <text x={cx} y={cy + h * 0.36} textAnchor="middle" fontSize="12" letterSpacing="3" fill="#a8834a" style={{ direction: 'ltr' }}>
        {tr(locale, 'وجاهة', 'WIJAHA')} · {person.rank}
      </text>
    </g>
  );
}

/** One A4 page of eight folding table cards (two columns, four rows) with cut and fold guides. */
export const NameCardPage = forwardRef<SVGSVGElement, { people: CardPerson[]; locale: string; page: number; pages: number }>(function NameCardPage(
  { people, locale, page, pages },
  ref,
) {
  const w = 340;
  const h = 236;
  const gapX = 24;
  const gapY = 20;
  const left = (PAGE_W - (2 * w + gapX)) / 2;
  const top = 52;
  return (
    <svg ref={ref} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} role="img" aria-label={tr(locale, `بطاقات الأسماء، صفحة ${page} من ${pages}`, `Name cards, page ${page} of ${pages}`)} className="w-full h-auto bg-white" style={{ fontFamily: FONT, direction: locale === 'ar' ? 'rtl' : 'ltr' }}>
      <rect width={PAGE_W} height={PAGE_H} fill="#ffffff" />
      {people.map((p, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = left + col * (w + gapX);
        const y = top + row * (h + gapY);
        const midY = y + h / 2;
        return (
          <g key={`${p.rank}-${i}`}>
            <rect x={x} y={y} width={w} height={h} rx="10" fill="#fffdf8" stroke="#9aa3b8" strokeWidth="1" strokeDasharray="5 4" />
            <rect x={x + 9} y={y + 9} width={w - 18} height={h - 18} rx="7" fill="none" stroke="#e2c07a" strokeWidth="1.4" />
            <line x1={x + 6} y1={midY} x2={x + w - 6} y2={midY} stroke="#cfae6a" strokeWidth="1" strokeDasharray="2 5" />
            {/* back face: upside down in the upper half so both sides read once folded */}
            <g transform={`rotate(180 ${x + w / 2} ${y + h / 4})`}>
              <Face person={p} cx={x + w / 2} cy={y + h / 4} w={w} h={h / 2} locale={locale} />
            </g>
            <Face person={p} cx={x + w / 2} cy={y + (3 * h) / 4} w={w} h={h / 2} locale={locale} />
          </g>
        );
      })}
      <text x={PAGE_W / 2} y={PAGE_H - 22} textAnchor="middle" fontSize="11" fill="#8c93a6" style={{ direction: 'ltr' }}>
        wijaha.web.app · {page}/{pages}
      </text>
    </svg>
  );
});
