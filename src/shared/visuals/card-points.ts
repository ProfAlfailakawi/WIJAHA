import type { WijahaResult } from '../types.ts';

export function shorten(text: string, max = 118): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40))}…`;
}

/** First five distinct, readable points from the result's blocks. */
export function pointsFromResult(result: WijahaResult): string[] {
  const out: string[] = [];
  const push = (t?: string) => {
    const s = (t ?? '').trim();
    if (s.length >= 12 && !out.some((x) => x === shorten(s))) out.push(shorten(s));
  };
  for (const b of result.blocks) {
    if (b.type === 'answer') b.points.forEach((p) => push(p.text));
  }
  for (const b of result.blocks) {
    if (out.length >= 5) break;
    if (b.type === 'checklist') b.groups.forEach((g) => g.items.forEach((i) => push(i.text)));
    if (b.type === 'timeline') b.days.forEach((d) => d.items.forEach((i) => push(i.title)));
  }
  for (const s of result.summary) {
    if (out.length >= 5) break;
    push(s);
  }
  return out.slice(0, 5);
}
