import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fromPercent, planLayout, ROOM, type LayoutKind } from '../../shared/visuals/seating.ts';
import { Chair, Door, FurnitureView, PersonDisc, Room, svgDir, tr, useSvgIds, VisualDefs, type Tone } from './svg-kit.tsx';

export interface FloorSeat {
  id: string;
  label: string;
  role?: string;
  rank?: number;
  /** Percent coordinates (5..95), as stored in SeatNode. */
  x: number;
  y: number;
}

const isAide = (s: FloorSeat) => /مترجم|interpreter|منسق|liaison|مسؤول المراسم|protocol lead/i.test(`${s.label} ${s.role ?? ''}`);

export function toneOf(seat: FloorSeat): Tone {
  if (seat.rank === 1) return 'host';
  if (seat.rank === 2) return 'chief';
  return isAide(seat) ? 'aide' : 'guest';
}

/** Short label for crowded plans: drops honorifics and keeps the first few characters. */
export function shortName(name: string, max = 11): string {
  const bare = name.replace(/^(معالي|سعادة|الدكتور|الدكتورة|المهندس|المهندسة|د\.|م\.|Dr\.?|Eng\.?|H\.E\.|Mr\.?|Mrs\.?|Ms\.?)\s*/i, '').trim() || name;
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare;
}

export const LAYOUT_NAMES: Record<LayoutKind, { ar: string; en: string }> = {
  majlis: { ar: 'المجلس الخليجي', en: 'Gulf majlis' },
  round: { ar: 'مائدة مستديرة', en: 'Round banquet' },
  rect: { ar: 'مباحثات ثنائية', en: 'Bilateral talks' },
  u_shape: { ar: 'حرف U', en: 'U-shape' },
  theatre: { ar: 'قاعة مسرح', en: 'Theatre' },
};

interface Props {
  layout: LayoutKind;
  seats: FloorSeat[];
  locale: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Change this number to replay the "guests take their seats" animation. */
  animateKey?: number;
  /** Enables drag-and-drop: dropping a seat on another swaps them. */
  onSwap?: (fromId: string, toId: string) => void;
  /** Show a short name label under every seat. */
  showNames?: boolean;
  /** Seats to ring in amber (e.g. precedence warnings). */
  warnIds?: string[];
  className?: string;
  ariaLabel?: string;
}

export const SeatingFloorplan = forwardRef<SVGSVGElement, Props>(function SeatingFloorplan(
  { layout, seats, locale, selectedId, onSelect, animateKey = 0, className, ariaLabel, onSwap, showNames = false, warnIds = [] },
  ref,
) {
  const innerRef = useRef<SVGSVGElement | null>(null);
  useImperativeHandle(ref, () => innerRef.current as SVGSVGElement);
  type Drag = { id: string; x: number; y: number; moved: boolean; target?: string };
  const [drag, setDragState] = useState<Drag | null>(null);
  // Pointer events can arrive faster than React re-renders, so the latest drag lives in a ref too.
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const svg = innerRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p2 = pt.matrixTransform(ctm.inverse());
    return { x: p2.x, y: p2.y };
  };
  const p = useSvgIds();
  const reduced = useReducedMotion();
  const plan = useMemo(() => planLayout(layout, seats.length), [layout, seats.length]);
  const ordered = useMemo(() => [...seats].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)), [seats]);
  const door = plan.door;
  const host = ordered.find((s) => s.rank === 1);
  const chief = ordered.find((s) => s.rank === 2);
  const hp = host ? fromPercent(host.x, host.y) : null;
  const cp = chief ? fromPercent(chief.x, chief.y) : null;
  const animate = animateKey > 0 && !reduced;

  const facingFor = (s: FloorSeat): number => {
    const spot = plan.seats.find((x) => x.rank === s.rank);
    if (spot) return spot.facing;
    const { x, y } = fromPercent(s.x, s.y);
    return (Math.atan2(255 - y, 400 - x) * 180) / Math.PI;
  };

  return (
    <svg
      ref={innerRef}
      viewBox={`0 0 ${ROOM.w} ${ROOM.h}`}
      role={onSelect ? 'group' : 'img'}
      aria-label={ariaLabel ?? tr(locale, 'مخطط الجلوس', 'Seating plan')}
      className={className ?? 'w-full h-auto select-none'}
      style={{ direction: svgDir(locale) }}
      onPointerMove={
        onSwap
          ? (e) => {
              const cur = dragRef.current;
              if (!cur) return;
              const { x, y } = toSvg(e);
              const moved = cur.moved || Math.hypot(x - cur.x, y - cur.y) > 8;
              let target: string | undefined;
              let best = 40;
              for (const sd of ordered) {
                if (sd.id === cur.id) continue;
                const q = fromPercent(sd.x, sd.y);
                const d = Math.hypot(q.x - x, q.y - y);
                if (d < best) {
                  best = d;
                  target = sd.id;
                }
              }
              setDrag({ ...cur, moved, target, x: moved ? x : cur.x, y: moved ? y : cur.y });
            }
          : undefined
      }
      onPointerUp={
        onSwap
          ? () => {
              const cur = dragRef.current;
              if (cur?.moved && cur.target) onSwap(cur.id, cur.target);
              setDrag(null);
            }
          : undefined
      }
      onPointerCancel={onSwap ? () => setDrag(null) : undefined}
    >
      <VisualDefs p={p} />
      <Room p={p} w={ROOM.w} h={ROOM.h} />

      {plan.furniture.map((f, i) => (
        <FurnitureView key={i} f={f} p={p} />
      ))}

      {layout === 'majlis' && (
        <text x={ROOM.w / 2} y="52" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--gold-ink, var(--gold))" letterSpacing="1">
          {tr(locale, 'صدر المجلس', 'HEAD OF THE MAJLIS')}
        </text>
      )}
      {layout === 'theatre' && (
        <text x={ROOM.w / 2} y="138" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink-2)">
          {tr(locale, 'المنصة', 'Stage')}
        </text>
      )}
      {layout === 'round' && (
        <text x="400" y="262" textAnchor="middle" fontSize="15" fontWeight="700" fill="#f6e7c1">
          {tr(locale, 'مائدة رسمية', 'Formal table')}
        </text>
      )}
      {layout === 'rect' && (
        <text x="400" y="262" textAnchor="middle" fontSize="15" fontWeight="700" fill="#f6e7c1">
          {tr(locale, 'طاولة المباحثات', 'Negotiation table')}
        </text>
      )}

      <Door x={door.x} y={ROOM.h - 10} w={door.w} label={tr(locale, 'المدخل', 'Entrance')} locale={locale} />

      {/* The host's right hand: a gold arc between rank 1 and rank 2. */}
      {hp && cp && (
        <g>
          <path
            d={`M${hp.x} ${hp.y}Q${(hp.x + cp.x) / 2} ${(hp.y + cp.y) / 2 + (layout === 'round' ? -26 : layout === 'majlis' || layout === 'u_shape' ? 34 : 22)} ${cp.x} ${cp.y}`}
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2.2"
            strokeDasharray="2 6"
            strokeLinecap="round"
          />
           {!showNames && <text x={(hp.x + cp.x) / 2} y={layout === 'majlis' || layout === 'u_shape' ? Math.max(hp.y, cp.y) + 44 : Math.min(hp.y, cp.y) - (layout === 'round' ? 36 : 20)} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--gold-ink, var(--gold))">
            {tr(locale, 'يمين المضيف', "Host's right")}
          </text>}
        </g>
      )}

      {ordered.map((seat, idx) => {
        const { x, y } = fromPercent(seat.x, seat.y);
        const tone = toneOf(seat);
        const selected = selectedId === seat.id;
        const initial = animate ? { x: door.x - x, y: door.y - y - 10, opacity: 0, scale: 0.6 } : false;
        return (
          <motion.g
            key={`${seat.id}-${animateKey}`}
            initial={initial}
            animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: animate ? 0.15 * idx : 0, duration: animate ? 0.7 : 0, type: 'spring', stiffness: 90, damping: 16 }}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={`${seat.rank ?? ''} ${seat.label}`}
            onClick={onSelect ? () => onSelect(seat.id) : undefined}
            onKeyDown={onSelect ? (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(seat.id)) : undefined}
            className={onSwap ? 'cursor-grab outline-none' : onSelect ? 'cursor-pointer outline-none' : undefined}
            onPointerDown={
              onSwap
                ? (e: React.PointerEvent) => {
                    innerRef.current?.setPointerCapture(e.pointerId);
                    const p0 = toSvg(e);
                    setDrag({ id: seat.id, x: p0.x, y: p0.y, moved: false });
                  }
                : undefined
            }
            style={{ transformBox: 'fill-box', transformOrigin: 'center', touchAction: onSwap ? 'none' : undefined, opacity: drag?.moved && drag.id === seat.id ? 0.35 : undefined }}
          >
            <title>{`${seat.rank ?? ''} · ${seat.label}${seat.role ? ` (${seat.role})` : ''}`}</title>
            {layout === 'majlis' ? (
              <rect x={x - 21} y={y - 21} width="42" height="42" rx="12" fill="#e9dcbd" stroke="#c9b383" strokeWidth="1.2" transform={`rotate(${facingFor(seat) - 90} ${x} ${y})`} />
            ) : (
              <Chair x={x} y={y} facing={facingFor(seat)} tone={tone} p={p} />
            )}
            {warnIds.includes(seat.id) && <circle cx={x} cy={y} r="25" fill="none" stroke="#d97706" strokeWidth="3" />}
            {drag?.moved && drag.target === seat.id && <circle cx={x} cy={y} r="27" fill="none" stroke="var(--gold)" strokeWidth="3.5" />}
            <PersonDisc x={x} y={y} rank={seat.rank ?? '•'} tone={tone} selected={selected} p={p} r={layout === 'majlis' ? 16 : 14} />
            {showNames && (
              <text x={x} y={y + 38} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--ink)" stroke="var(--bg)" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">
                {shortName(seat.label, 12)}
              </text>
            )}
          </motion.g>
        );
      })}

      {drag?.moved && (() => {
        const src = ordered.find((q) => q.id === drag.id);
        if (!src) return null;
        return (
          <g pointerEvents="none" opacity="0.92">
            <PersonDisc x={drag.x} y={drag.y} rank={src.rank ?? '•'} tone={toneOf(src)} p={p} r={19} />
          </g>
        );
      })()}

      {selectedId &&
        (() => {
          const seat = ordered.find((s) => s.id === selectedId);
          if (!seat) return null;
          const { x, y } = fromPercent(seat.x, seat.y);
          const text = seat.label.length > 26 ? `${seat.label.slice(0, 25)}…` : seat.label;
          const w = Math.max(96, text.length * 8.6 + 24);
          const bx = Math.max(24, Math.min(ROOM.w - 24 - w, x - w / 2));
          const by = y > 300 ? y - 62 : y < 200 ? y + 66 : y + 30;
          return (
            <g pointerEvents="none">
              <rect x={bx} y={by} width={w} height="30" rx="15" fill="var(--primary)" stroke="var(--gold)" strokeWidth="1.4" />
              <text x={bx + w / 2} y={by + 20} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--bg)">
                {text}
              </text>
            </g>
          );
        })()}
    </svg>
  );
});

/** Ordered legend that mirrors the plan; selecting a row highlights the seat. */
export function SeatLegend({
  seats,
  locale,
  selectedId,
  onSelect,
}: {
  seats: FloorSeat[];
  locale: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const ordered = [...seats].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const bg: Record<Tone, string> = {
    host: 'bg-[#0f1b33] text-[#f6e7c1]',
    chief: 'bg-[#cfae6a] text-[#14213d]',
    guest: 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--ink-3)]',
    aide: 'bg-[#0f766e] text-white',
  };
  return (
    <ol className="grid gap-2 sm:grid-cols-2" aria-label={tr(locale, 'ترتيب الأسبقية', 'Order of precedence')}>
      {ordered.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onSelect?.(s.id)}
            aria-pressed={selectedId === s.id}
            className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-start transition-colors cursor-pointer min-h-[48px] ${
              selectedId === s.id ? 'border-[var(--gold)] bg-[var(--surface-2)]' : 'border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--surface-2)]/60'
            }`}
          >
            <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold tabular-nums ${bg[toneOf(s)]}`}>{s.rank ?? '•'}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--ink)] truncate">{s.label}</span>
              {s.role && <span className="block text-xs text-[var(--ink-3)] truncate">{s.role}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
