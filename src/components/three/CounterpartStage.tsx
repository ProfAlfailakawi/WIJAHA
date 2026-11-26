import React, { useEffect, useRef, useState } from 'react';
import type { PostureScene } from './figure.ts';
import { REACTION_POSES, REACTION_TEXT, type Reaction } from '../../shared/tools/counterpart.ts';

/**
 * "Embodied simulation": a 3D band behind the practice narrative where the counterpart (host sheikh or
 * delegation head) reacts with a posture. Reuses the posture figure; three.js loads on demand and the band
 * simply disappears if WebGL is unavailable.
 */
export function CounterpartStage({ reaction, name, role, ar }: { reaction: Reaction; name?: string; role?: string; ar: boolean }) {
  const host = useRef<HTMLDivElement | null>(null);
  const scene = useRef<PostureScene | null>(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef(reaction);
  latest.current = reaction;

  useEffect(() => {
    let alive = true;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    (async () => {
      try {
        const mod = await import('./figure.ts');
        if (!alive || !host.current) return;
        const s = new mod.PostureScene(host.current);
        s.controls.enabled = false;
        s.controls.autoRotate = false;
        s.camera.position.set(0.3, 1.15, 4.3);
        s.controls.target.set(0, 0.9, 0);
        s.controls.update();
        s.renderer.domElement.style.touchAction = 'auto';
        scene.current = s;
        s.setPoseData(REACTION_POSES[latest.current], true);
        s.start();
        ro = new ResizeObserver(() => s.resize());
        ro.observe(host.current);
        io = new IntersectionObserver(([e]) => (e.isIntersecting ? s.start() : s.stop()), { threshold: 0.01 });
        io.observe(host.current);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      alive = false;
      ro?.disconnect();
      io?.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.setPoseData(REACTION_POSES[reaction]);
  }, [reaction]);

  if (failed) return null;
  const text = REACTION_TEXT[reaction];
  return (
    <div className="wj-counterpart" data-reaction={reaction} data-testid="counterpart-stage">
      <div ref={host} className="absolute inset-0" aria-hidden="true" />
      <div className="wj-counterpart-caption" aria-live="polite">
        {name && <span className="font-semibold">{name}{role && role !== name ? ` · ${role}` : ''}</span>}
        <span className="wj-counterpart-reaction">{ar ? text.ar : text.en}</span>
      </div>
    </div>
  );
}
