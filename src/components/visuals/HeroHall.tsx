import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Hall3D, type Hall3DHandle } from '../three/Hall3D';
import type { CameraPreset, HallSeat } from '../three/hall-scene.ts';
import { planLayout, ROOM, type LayoutKind, type Plan } from '../../shared/visuals/seating.ts';
import type { PreviewChip, PreviewIcon } from '../../lib/understanding-preview';

/**
 * "The hall forms as you type": a decorative hall behind the home search box. It reads the same client-side
 * hints that power the «فهمنا:» chips (guest count and occasion) and reshapes the table and seats live.
 * three.js is loaded only on capable desktops; phones, low-power devices and reduced motion get a static
 * top-view drawing of the same plan instead. Purely visual: it never touches the search itself.
 */

const LAYOUT_FOR: Partial<Record<PreviewIcon, LayoutKind>> = {
  meal: 'round', seating: 'round', delegation: 'rect', signing: 'rect', invite: 'theatre', gift: 'majlis', trip: 'majlis',
};

export function hallFromChips(chips: PreviewChip[]): { layout: LayoutKind; count: number } {
  const occ = chips.find((c) => c.key === 'occ');
  const countChip = chips.find((c) => c.key === 'count');
  const n = countChip ? Number((countChip.label.match(/\d+/) ?? ['0'])[0]) : 0;
  const layout = (occ && LAYOUT_FOR[occ.icon]) || 'majlis';
  return { layout, count: n > 1 ? n : 8 };
}

/** Rich 3D only where it will run smoothly; everything else gets the static drawing. */
export function canRunHeroHall(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (window.matchMedia('(max-width: 767px), (pointer: coarse)').matches) return false;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return false;
    if ((nav.hardwareConcurrency ?? 8) <= 4) return false;
    if ((nav.deviceMemory ?? 8) <= 4) return false;
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export interface HeroHallHandle {
  /** Glide the camera into the principal guest's seat. Returns false when there is nothing to animate. */
  settle: () => boolean;
}

function StaticHall({ plan }: { plan: Plan }) {
  return (
    <svg viewBox={`0 0 ${ROOM.w} ${ROOM.h}`} preserveAspectRatio="xMidYMid meet" className="wj-hero-hall-svg" aria-hidden="true" data-testid="hero-hall-static">
      <g fill="none" stroke="#E8C882" strokeOpacity=".55" strokeWidth="2">
        {plan.furniture.map((f, i) =>
          f.kind === 'ellipse' ? (
            <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill="#E8C882" fillOpacity=".08" />
          ) : f.kind === 'rrect' ? (
            <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill="#E8C882" fillOpacity={f.tone === 'rug' ? 0.04 : 0.08} />
          ) : (
            <circle key={i} cx={f.x} cy={f.y} r="10" />
          ),
        )}
      </g>
      {plan.seats.map((s) => (
        <circle key={s.rank} cx={s.x} cy={s.y} r={s.rank <= 2 ? 15 : 12} fill={s.rank === 2 ? '#E8C882' : s.rank === 1 ? '#F7F2E8' : 'none'} fillOpacity={s.rank <= 2 ? 0.9 : 1} stroke="#E8C882" strokeOpacity=".8" strokeWidth="2.5" />
      ))}
      <path d={`M${plan.door.x - plan.door.w / 2} ${ROOM.h - 2}H${plan.door.x + plan.door.w / 2}`} stroke="#E8C882" strokeWidth="4" />
    </svg>
  );
}

export const HeroHall = forwardRef<HeroHallHandle, { chips: PreviewChip[]; rtl: boolean }>(function HeroHall({ chips, rtl }, ref) {
  const [rich] = useState(canRunHeroHall);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const target = hallFromChips(chips);
  // Debounce so a fast typist does not rebuild the room on every key.
  const [shape, setShape] = useState(target);
  useEffect(() => {
    const id = window.setTimeout(() => setShape((s) => (s.layout === target.layout && s.count === target.count ? s : target)), 260);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.layout, target.count]);

  const plan = useMemo(() => planLayout(shape.layout, shape.count), [shape]);
  const seats = useMemo<HallSeat[]>(() => plan.seats.map((s) => ({ id: `s${s.rank}`, label: '', rank: s.rank, x: s.x, y: s.y, facing: s.facing })), [plan]);
  const [preset, setPreset] = useState<CameraPreset>('overview');
  const [nonce, setNonce] = useState(0);
  const hall = useRef<Hall3DHandle>(null);

  useImperativeHandle(ref, () => ({
    settle: () => {
      if (!rich || failed || !ready) return false;
      setPreset('chief');
      setNonce((n) => n + 1);
      return true;
    },
  }), [rich, failed, ready]);

  return (
    <div className="wj-hero-hall" aria-hidden="true" data-testid="hero-hall" data-mode={rich && !failed ? '3d' : 'static'} data-layout={shape.layout} data-count={plan.seats.length}>
      {rich && !failed ? (
        <Hall3D
          ref={hall}
          plan={plan}
          seats={seats}
          rtl={rtl}
          preset={preset}
          presetNonce={nonce}
          interactive={false}
          labels={false}
          onReady={() => setReady(true)}
          onUnsupported={() => setFailed(true)}
          ariaLabel=""
          className="absolute inset-0"
        />
      ) : (
        <StaticHall plan={plan} />
      )}
    </div>
  );
});
