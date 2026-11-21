/** "My organisation's protocol": local manual search. The manual never leaves the browser. */
import { normalizeArabic } from '../arabic.ts';

export interface Chunk {
  id: number;
  heading: string;
  text: string;
}

export const MAX_MANUAL_CHARS = 400_000;

/** Splits on headings (#, numbered lines, short lines ending with a colon) and long paragraphs. */
export function chunkManual(raw: string): Chunk[] {
  const lines = raw.replace(/\r/g, '').slice(0, MAX_MANUAL_CHARS).split('\n');
  const chunks: Chunk[] = [];
  let heading = '';
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (text.length > 0) {
      // Keep chunks searchable: break long text into ~600 character windows on sentence ends.
      let rest = text;
      while (rest.length > 700) {
        const cut = Math.max(rest.lastIndexOf('. ', 600), rest.lastIndexOf('۔ ', 600), rest.lastIndexOf('؛ ', 600), 400);
        chunks.push({ id: chunks.length, heading, text: rest.slice(0, cut + 1).trim() });
        rest = rest.slice(cut + 1).trim();
      }
      if (rest) chunks.push({ id: chunks.length, heading, text: rest });
    }
    buf = [];
  };
  for (const line of lines) {
    const l = line.trim();
    const isHeading = /^#{1,4}\s/.test(l) || /^(\d+[.)]|[أ-ي]\))\s+\S/.test(l) && l.length < 90 || (l.length > 0 && l.length < 60 && /[:：]$/.test(l));
    if (isHeading) {
      flush();
      heading = l.replace(/^#{1,4}\s*/, '').replace(/[:：]$/, '');
    } else if (l === '') {
      flush();
    } else buf.push(l);
  }
  flush();
  return chunks;
}

const STOP = new Set(['في', 'من', 'على', 'الى', 'عن', 'ما', 'هل', 'هي', 'هو', 'ان', 'او', 'مع', 'كيف', 'متى', 'اين', 'the', 'a', 'of', 'to', 'in', 'is', 'and', 'or', 'how', 'what', 'when', 'where', 'do', 'we']);

function tokens(s: string): string[] {
  return normalizeArabic(s)
    .split(' ')
    .map((w) => w.replace(/^(وال|بال|فال|ال|لل)/, '').replace(/^و(?=.{4,})/, ''))
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export interface Hit {
  chunk: Chunk;
  score: number;
  matched: string[];
}

export function searchManual(chunks: Chunk[], query: string, limit = 4): Hit[] {
  const q = [...new Set(tokens(query))];
  if (q.length === 0) return [];
  const df = new Map<string, number>();
  const docs = chunks.map((c) => new Set(tokens(`${c.heading} ${c.text}`)));
  for (const t of q) df.set(t, docs.filter((d) => [...d].some((w) => w === t || (t.length > 3 && w.startsWith(t)))).length);
  const hits: Hit[] = [];
  chunks.forEach((chunk, i) => {
    let score = 0;
    const matched: string[] = [];
    for (const t of q) {
      const present = [...docs[i]].some((w) => w === t || (t.length > 3 && w.startsWith(t)));
      if (present) {
        score += 1 + Math.log(1 + chunks.length / (1 + (df.get(t) ?? 0)));
        matched.push(t);
        if (tokens(chunk.heading).includes(t)) score += 1.5;
      }
    }
    if (score > 0 && matched.length >= Math.min(2, q.length)) hits.push({ chunk, score, matched });
  });
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
