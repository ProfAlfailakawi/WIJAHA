import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ShowcaseKind, ShowcaseScene } from './showcase.ts';

export interface ShowcaseHandle {
  snapshot: () => Promise<Blob>;
}

export const ShowcaseViewer = forwardRef<ShowcaseHandle, { kind: ShowcaseKind; ariaLabel: string; onUnsupported?: () => void }>(function ShowcaseViewer({ kind, ariaLabel, onUnsupported }, ref) {
  const host = useRef<HTMLDivElement | null>(null);
  const scene = useRef<ShowcaseScene | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({ snapshot: () => (scene.current ? scene.current.snapshot() : Promise.reject(new Error('not ready'))) }), []);

  useEffect(() => {
    let alive = true;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    const onVis = () => (document.hidden ? scene.current?.stop() : scene.current?.start());
    setReady(false);
    (async () => {
      try {
        const mod = await import('./showcase.ts');
        if (!alive || !host.current) return;
        const s = new mod.ShowcaseScene(host.current, kind);
        scene.current = s;
        s.start();
        ro = new ResizeObserver(() => s.resize());
        ro.observe(host.current);
        io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? s.start() : s.stop()), { threshold: 0.01 });
        io.observe(host.current);
        document.addEventListener('visibilitychange', onVis);
        setReady(true);
      } catch {
        onUnsupported?.();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return <div ref={host} role="group" aria-label={ariaLabel} data-ready={ready ? 'true' : 'false'} data-testid="showcase" className="relative w-full aspect-[4/5] sm:aspect-[16/10] min-h-[320px] rounded-2xl overflow-hidden bg-[#0e1630]" />;
});
