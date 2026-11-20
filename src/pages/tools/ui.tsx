import React from 'react';

export const btn =
  'min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const btnPrimary =
  'min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--primary)] bg-[var(--primary)] px-4 text-sm font-bold text-[var(--bg)] hover:opacity-90 cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
export const card = 'rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6';
export const input =
  'w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[var(--ink)] placeholder:text-[var(--ink-3)]';

export function ToolHero({ icon, kicker, title, sub }: { icon: React.ReactNode; kicker: string; title: string; sub: string }) {
  return (
    <header className="v2-hero !rounded-[28px] px-6 sm:px-10 py-8 sm:py-11 space-y-3">
      <span className="inline-flex items-center gap-2 text-[0.72rem] tracking-[0.35em] text-[var(--gold)] uppercase">
        {icon}
        {kicker}
      </span>
      <h1 className="text-3xl sm:text-5xl font-extrabold leading-[1.2] text-[var(--primary-fg)]">{title}</h1>
      <p className="max-w-3xl text-[var(--primary-fg)]/80 leading-relaxed sm:text-lg">{sub}</p>
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">{children}</div>;
}
