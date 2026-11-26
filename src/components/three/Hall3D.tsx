import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CameraPreset, HallScene, HallSeat } from './hall-scene.ts';
import type { Plan } from '../../shared/visuals/seating.ts';

export interface Hall3DHandle {
  snapshot: () => Promise<Blob>;
  /** Walk the guests in from the door in order of precedence; resolves when everyone is seated. */
  walkIn: () => Promise<void>;
  /** The WebGL canvas (null until three.js has loaded). */
  canvas: () => HTMLCanvasElement | null;
}

export interface Hall3DProps {
  plan: Plan;
  seats: HallSeat[];
  selectedId?: string | null;
  warnIds?: string[];
  rtl: boolean;
  preset: CameraPreset;
  presetNonce: number;
  onPick?: (id: string) => void;
  onUnsupported?: () => void;
  ariaLabel: string;
  className?: string;
  /** Decorative mode: no orbiting/picking. Default true. */
  interactive?: boolean;
  /** Show name labels above the figures. Default true. */
  labels?: boolean;
  onReady?: () => void;
}

/** WebGL view of the hall. three.js is loaded on demand so it never weighs on the other pages. */
export const Hall3D = forwardRef<Hall3DHandle, Hall3DProps>(function Hall3D(props, ref) {
  const host = useRef<HTMLDivElement | null>(null);
  const scene = useRef<HallScene | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef(props);
  latest.current = props;

  useImperativeHandle(
    ref,
    () => ({
      snapshot: () => (scene.current ? scene.current.snapshot() : Promise.reject(new Error('not ready'))),
      walkIn: () => (scene.current ? scene.current.walkIn() : Promise.resolve()),
      canvas: () => scene.current?.canvas ?? null,
    }),
    [],
  );

  useEffect(() => {
    let alive = true;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    const onVis = () => {
      if (!scene.current) return;
      if (document.hidden) scene.current.stop();
      else scene.current.start();
    };
    (async () => {
      try {
        const mod = await import('./hall-scene.ts');
        if (!alive || !host.current) return;
        const s = new mod.HallScene(host.current, { interactive: latest.current.interactive ?? true, labels: latest.current.labels ?? true });
        scene.current = s;
        const p = latest.current;
        s.onPick = (id) => latest.current.onPick?.(id);
        s.update({ plan: p.plan, seats: p.seats, selectedId: p.selectedId, warnIds: p.warnIds, rtl: p.rtl });
        s.setPreset(p.preset, true);
        s.start();
        ro = new ResizeObserver(() => s.resize());
        ro.observe(host.current);
        io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? s.start() : s.stop()), { threshold: 0.01 });
        io.observe(host.current);
        document.addEventListener('visibilitychange', onVis);
        setReady(true);
        latest.current.onReady?.();
      } catch {
        latest.current.onUnsupported?.();
      }
    })();
    return () => {
      alive = false;
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.update({ plan: props.plan, seats: props.seats, selectedId: props.selectedId, warnIds: props.warnIds, rtl: props.rtl });
  }, [props.plan, props.seats, props.selectedId, props.warnIds, props.rtl]);

  useEffect(() => {
    scene.current?.setPreset(props.preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.preset, props.presetNonce]);

  return (
    <div
      ref={host}
      role="group"
      aria-label={props.ariaLabel}
      className={props.className ?? 'relative w-full aspect-[16/10] min-h-[280px] rounded-2xl overflow-hidden bg-[#0e1630]'}
      data-ready={ready ? 'true' : 'false'}
      data-testid="hall3d"
    />
  );
});
