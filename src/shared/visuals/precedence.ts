import { normalizeArabic } from '../arabic.ts';

/**
 * A SUGGESTED order from job titles (Arabic or English). The official order of precedence between offices is
 * set by the host state's protocol, so this is a starting point the user can reorder, never an authority.
 */

export interface Guest {
  id: string;
  name: string;
  title: string;
}

/** Higher tier = higher precedence. 1 = unknown or general. */
const TIERS: Array<[number, RegExp]> = [
  [10, /رييس الدوله|رييس الجمهوريه|جلاله|ملك|سلطان|امير البلاد|رييس الدوله|head of state|\bking\b|\bsultan\b|\bemir\b|president of the (republic|state)/u],
  [9, /ولي العهد|رييس الوزراء|رييس مجلس الوزراء|رييس مجلس النواب|رييس مجلس الشوري|رييس مجلس الامه|crown prince|prime minister|speaker of/u],
  [8, /نايب رييس الوزراء|نايب رييس مجلس الوزراء|صاحب السمو|سمو الامير|سمو الشيخ|deputy prime minister|his highness|royal highness/u],
  [7, /وزير|معالي|minister|secretary of state/u],
  [6, /سفير|ambassador|high commissioner/u],
  [5, /وكيل وزاره|وكيل الوزاره|رييس هييه|رييس جامعه|محافظ|رييس مجلس الاداره|under-?secretary|governor|university president|chairman|rector/u],
  [4, /وكيل مساعد|مدير\s+(ال)?عام|الرييس التنفيذي|رييس تنفيذي|ceo|director general|assistant under-?secretary|chief executive/u],
  [3, /مدير|استاذ دكتور|عميد|director|professor|dean|head of/u],
  [2, /دكتور|مهندس|مسوول|مستشار|dr\.?\b|engineer|manager|advisor|adviser|officer/u],
];

export function titleTier(title: string): number {
  const n = normalizeArabic(title);
  for (const [tier, re] of TIERS) if (re.test(n)) return tier;
  return 1;
}

/** Stable sort: higher tier first, ties keep the order the user entered. */
export function sortByPrecedence<T extends { title: string }>(guests: T[]): T[] {
  return guests
    .map((g, i) => ({ g, i, t: titleTier(g.title) }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map((x) => x.g);
}

export interface Violation {
  higher: string;
  lower: string;
}

/** Pairs where a lower-tier guest is seated before a higher-tier one (ids). Only the closest offender per guest is reported. */
export function findViolations<T extends { id: string; title: string }>(ordered: T[]): Violation[] {
  const out: Violation[] = [];
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      if (titleTier(ordered[i].title) < titleTier(ordered[j].title)) {
        out.push({ higher: ordered[j].id, lower: ordered[i].id });
        break;
      }
    }
  }
  return out;
}

export function swap<T>(list: T[], a: number, b: number): T[] {
  if (a === b || a < 0 || b < 0 || a >= list.length || b >= list.length) return list;
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
