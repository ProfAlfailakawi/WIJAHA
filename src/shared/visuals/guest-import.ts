import { strFromU8, unzipSync } from 'fflate';
import type { Guest } from './precedence.ts';

/** Imports a guest list from pasted text (Excel copies as tab-separated), CSV, or a real .xlsx file. Runs only in the browser. */

export const MAX_GUESTS = 60;

const HEADER_RE = /^(الاسم|اسم|name|full name|الضيف|guest)$/i;
const TITLE_HEAD_RE = /^(المنصب|اللقب|الوظيفة|الصفة|title|position|role|designation)$/i;

/** Splits one line on a delimiter, honouring double quotes. */
export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n');
  for (const d of ['\t', ';', '|']) if (sample.includes(d)) return d;
  const commas = (sample.match(/,/g) ?? []).length;
  // A comma is a delimiter only if most lines have one (an Arabic "،" or a comma inside a name is not).
  if (commas >= Math.max(1, Math.floor(lines.slice(0, 5).length / 2))) return ',';
  return '';
}

export function rowsToGuests(rows: string[][]): { guests: Guest[]; skipped: number; hadHeader: boolean } {
  let data = rows.filter((r) => r.some((c) => c.trim()));
  let hadHeader = false;
  if (data.length > 0 && HEADER_RE.test((data[0][0] ?? '').trim())) {
    hadHeader = true;
    data = data.slice(1);
  } else if (data.length > 0 && data[0].length > 1 && TITLE_HEAD_RE.test((data[0][1] ?? '').trim())) {
    hadHeader = true;
    data = data.slice(1);
  }
  const guests: Guest[] = [];
  let skipped = 0;
  for (const r of data) {
    const name = (r[0] ?? '').trim();
    if (!name) {
      skipped++;
      continue;
    }
    if (guests.length >= MAX_GUESTS) {
      skipped++;
      continue;
    }
    guests.push({ id: `g${guests.length + 1}`, name: name.slice(0, 60), title: (r[1] ?? '').trim().slice(0, 80) });
  }
  return { guests, skipped, hadHeader };
}

export function parseGuestText(text: string) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { guests: [] as Guest[], skipped: 0, hadHeader: false };
  let delim = detectDelimiter(lines);
  const rows: string[][] = lines.map((l) => {
    if (delim) return splitCsvLine(l, delim);
    // "Name - Title" / "Name — Title" on a single column
    const m = /^(.*?)\s+[-–—]\s+(.*)$/.exec(l);
    return m ? [m[1].trim(), m[2].trim()] : [l.trim()];
  });
  void delim;
  return rowsToGuests(rows);
}

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&');

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Minimal .xlsx reader: first worksheet, shared and inline strings. No external service, no macros executed. */
export function parseXlsxRows(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes, { filter: (f) => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(f.name) });
  const shared: string[] = [];
  const ss = files['xl/sharedStrings.xml'];
  if (ss) {
    for (const si of strFromU8(ss).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      const parts = [...si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1]));
      shared.push(parts.join(''));
    }
  }
  const sheetName = Object.keys(files).filter((n) => n.startsWith('xl/worksheets/')).sort()[0];
  if (!sheetName) return [];
  const xml = strFromU8(files[sheetName]);
  const rows: string[][] = [];
  for (const row of xml.matchAll(/<row\b[^>]*?(?:\sr="(\d+)")?[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\sr="([A-Z]+)\d+"/.exec(` ${attrs}`);
      const type = /\st="([a-zA-Z]+)"/.exec(` ${attrs}`)?.[1];
      const body = c[2] ?? '';
      let value = '';
      if (type === 's') value = shared[Number(/<v>(\d+)<\/v>/.exec(body)?.[1])] ?? '';
      else if (type === 'inlineStr') value = decode([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));
      else value = decode(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');
      const idx = ref ? colIndex(ref[1]) : cells.length;
      while (cells.length < idx) cells.push('');
      cells[idx] = value.trim();
    }
    rows.push(cells);
  }
  return rows;
}

export async function parseGuestFile(file: File): Promise<{ guests: Guest[]; skipped: number; hadHeader: boolean }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    return rowsToGuests(parseXlsxRows(buf));
  }
  return parseGuestText(await file.text());
}
