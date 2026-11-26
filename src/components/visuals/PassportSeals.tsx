import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Volume2 } from 'lucide-react';

/**
 * "Wijaha passport": diamond seals stamped one after another with a soft paper thud (Web Audio, generated in
 * the browser; no audio files). Sound only plays after the visitor has interacted with the page, and never
 * with reduced motion. Display only: the values come from the report or exam result already on screen.
 */

export interface PassportItem {
  key: string;
  code: string;
  label: string;
  /** true: a stamped seal; false: an empty seal (not assessed / not yet earned). */
  stamped: boolean;
  /** Short value inside the seal, e.g. "86%" or "✓". */
  value?: string;
  /** Screen-reader text for an empty seal. */
  emptyNote?: string;
}

let ctx: AudioContext | null = null;
function thud(delay: number) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    void ctx.resume();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.26);
  } catch {
    /* audio unavailable */
  }
}

const STEP_MS = 360;

export function PassportSeals({ items, ar, title, testId = 'passport' }: { items: PassportItem[]; ar: boolean; title: string; testId?: string }) {
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0);
  const played = useRef(-1);

  useEffect(() => {
    if (reduced || played.current === run) return;
    played.current = run;
    const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
    if (!active && run === 0) return;
    items.forEach((it, i) => {
      if (it.stamped) thud(0.12 + (i * STEP_MS) / 1000 + 0.22);
    });
  }, [run, reduced, items]);

  return (
    <section className="wj-passport" aria-label={title} data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="wj-passport-title">{title}</h2>
        {!reduced && (
          <button type="button" onClick={() => setRun((n) => n + 1)} className="min-h-[40px] inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer" data-testid={`${testId}-replay`}>
            <Volume2 className="w-4 h-4" aria-hidden="true" />
            {ar ? 'أعد الختم بالصوت' : 'Stamp again with sound'}
          </button>
        )}
      </div>
      <ol key={run} className="wj-passport-grid">
        {items.map((it, i) => (
          <li key={it.key} className="wj-passport-item" data-stamped={it.stamped ? 'true' : 'false'}>
            <span className="wj-diamond" style={{ animationDelay: `${120 + i * STEP_MS}ms` }} aria-hidden="true">
              <span className="wj-diamond-in">
                <span className="wj-diamond-code">{it.code}</span>
                {it.stamped && it.value && <span className="wj-diamond-pct">{it.value}</span>}
              </span>
            </span>
            <span className="wj-passport-label">{it.label}</span>
            <span className="sr-only">{it.stamped ? it.value ?? '' : it.emptyNote ?? ''}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
