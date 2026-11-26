import React from 'react';
import { formatCountdown, type LiveStatus, type Step } from '../../shared/tools/live.ts';

/**
 * "Event ops room": a big circular clock whose gold ring depletes over the current step (or the countdown
 * to the next one), and a horizontal timeline that slides past a fixed "now" needle. When an emergency
 * playbook is open the whole panel floods red. Reads the page's existing schedule state; changes nothing.
 */

const WINDOW_MIN = 180; // minutes visible across the timeline

export function OpsRoom({ steps, status, now, emergency, ar, title }: { steps: Step[]; status: LiveStatus; now: Date; emergency: boolean; ar: boolean; title: (s: Step) => string }) {
  const clock = new Intl.DateTimeFormat(ar ? 'ar-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const t = now.getTime();

  let frac = 1;
  let seconds = 0;
  let label = '';
  if (status.phase === 'running' && status.current) {
    const span = status.current.end.getTime() - status.current.start.getTime();
    frac = Math.max(0, Math.min(1, (status.current.end.getTime() - t) / Math.max(1, span)));
    seconds = status.secondsLeftInCurrent ?? 0;
    label = title(status.current);
  } else if ((status.phase === 'before' || status.phase === 'between') && status.next) {
    // Before the next step the ring counts down the last hour.
    seconds = status.secondsToNext ?? 0;
    frac = Math.max(0, Math.min(1, seconds / 3600));
    label = (ar ? 'التالي: ' : 'Next: ') + title(status.next);
  } else {
    frac = 0;
    label = ar ? 'انتهى الجدول' : 'Run sheet complete';
  }

  const R = 120;
  const C = 2 * Math.PI * R;
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  const minAngle = ((now.getMinutes() + now.getSeconds() / 60) / 60) * 360;
  const hourAngle = (((now.getHours() % 12) + now.getMinutes() / 60) / 12) * 360;

  // Timeline: px per minute in a 1000-wide viewBox, "now" at the centre.
  const ppm = 1000 / WINDOW_MIN;
  // Time flows with the reading direction: rightwards in English, leftwards in Arabic.
  const xOf = (d: Date) => 500 + (ar ? -1 : 1) * ((d.getTime() - t) / 60_000) * ppm;

  return (
    <>
    {emergency && <div className="wj-ops-flood" aria-hidden="true" data-testid="ops-flood" />}
    <section className="wj-ops" data-emergency={emergency ? 'true' : 'false'} aria-label={ar ? 'غرفة العمليات' : 'Ops room'} data-testid="ops-room">
      <div className="wj-ops-grid">
        <svg viewBox="0 0 300 300" className="wj-ops-clock" role="img" aria-label={`${clock.format(now)} · ${label} · ${formatCountdown(seconds)}`}>
          <circle cx="150" cy="150" r="140" className="wj-ops-face" />
          {ticks.map((i) => (
            <line key={i} x1="150" y1={i % 5 ? 18 : 14} x2="150" y2={i % 5 ? 23 : 28} transform={`rotate(${i * 6} 150 150)`} className="wj-ops-tick" strokeWidth={i % 5 ? 1 : 2.5} />
          ))}
          <circle cx="150" cy="150" r={R} className="wj-ops-track" />
          <circle
            cx="150" cy="150" r={R} className="wj-ops-ring"
            strokeDasharray={`${C * frac} ${C}`}
            transform="rotate(-90 150 150)"
            data-testid="ops-ring"
          />
          <line x1="150" y1="150" x2="150" y2="92" className="wj-ops-hand" strokeWidth="5" transform={`rotate(${hourAngle} 150 150)`} />
          <line x1="150" y1="150" x2="150" y2="62" className="wj-ops-hand" strokeWidth="3" transform={`rotate(${minAngle} 150 150)`} />
          <circle cx="150" cy="150" r="6" className="wj-ops-pin" />
          <text x="150" y="208" textAnchor="middle" className="wj-ops-count" style={{ direction: 'ltr' }}>{formatCountdown(seconds)}</text>
          <text x="150" y="232" textAnchor="middle" className="wj-ops-now">{clock.format(now)}</text>
        </svg>
        <div className="wj-ops-side">
          <p className="wj-ops-label">{emergency ? (ar ? 'حالة طارئة نشطة' : 'Emergency active') : ar ? 'الآن' : 'Now'}</p>
          <p className="wj-ops-title">{label}</p>
        </div>
      </div>
      <svg viewBox="0 0 1000 96" preserveAspectRatio="none" className="wj-ops-line" aria-hidden="true" data-testid="ops-timeline">
        <line x1="0" y1="60" x2="1000" y2="60" className="wj-ops-rail" />
        {steps.map((s) => {
          const x1 = xOf(s.start);
          const x2 = xOf(s.end);
          if (x2 < -50 || x1 > 1050) return null;
          const state = s.end.getTime() <= t ? 'done' : s.start.getTime() <= t ? 'now' : 'todo';
          return (
            <g key={s.index} data-state={state} className="wj-ops-step">
              <rect x={Math.min(x1, x2) + 1.5} y="50" width={Math.max(2, Math.abs(x2 - x1) - 3)} height="20" rx="4" />
            </g>
          );
        })}
        <line x1="500" y1="20" x2="500" y2="90" className="wj-ops-needle" />
        <path d="M500 14l7 7-7 7-7-7z" className="wj-ops-needle-head" />
      </svg>
      <ol className="wj-ops-labels" aria-hidden="true">
        {(() => {
          // One label per visible step start, skipping any that would collide with the previous one.
          const shown: number[] = [];
          return steps.map((s) => {
          const x = xOf(s.start) / 10;
          if (x < 4 || x > 96 || shown.some((v) => Math.abs(v - x) < 16)) return null;
          shown.push(x);
          return (
            <li key={s.index} style={{ left: `${x}%` }}>
              <span dir="ltr">{clock.format(s.start)}</span>
            </li>
          );
          });
        })()}
      </ol>
    </section>
    </>
  );
}
