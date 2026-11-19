/**
 * Pure Arabic text normalization, Gulf/regional dialect expansion,
 * deterministic local vector embedding for hybrid search, and WCAG contrast math.
 */

const TASHKEEL_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL_REGEX = /\u0640/g;

export function normalizeArabic(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(TASHKEEL_REGEX, '')
    .replace(TATWEEL_REGEX, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DialectSynonym {
  term: string;
  canonicalAr: string;
  canonicalEn: string;
  dialect: 'gulf' | 'egyptian' | 'levantine' | 'msa';
  topic: string;
}

export const DEFAULT_DIALECT_SYNONYMS: DialectSynonym[] = [
  { term: 'عزيمه', canonicalAr: 'مأدبة عشاء رسمي ضيافة', canonicalEn: 'formal dinner banquet hospitality', dialect: 'gulf', topic: 'dining' },
  { term: 'عزيمة', canonicalAr: 'مأدبة عشاء رسمي ضيافة', canonicalEn: 'formal dinner banquet hospitality', dialect: 'gulf', topic: 'dining' },
  { term: 'شلون اتصرف', canonicalAr: 'قواعد الإتيكيت والتصرف السليم', canonicalEn: 'personal etiquette conduct rules', dialect: 'gulf', topic: 'etiquette' },
  { term: 'شنو نجهز', canonicalAr: 'قائمة التجهيز والاستعداد', canonicalEn: 'preparation checklist readiness', dialect: 'gulf', topic: 'visit_program' },
  { term: 'شنو نحتاج', canonicalAr: 'متطلبات الزيارة وقائمة التجهيز', canonicalEn: 'visit requirements checklist', dialect: 'gulf', topic: 'visit_program' },
  { term: 'بكره', canonicalAr: 'غداً عاجل', canonicalEn: 'tomorrow urgent', dialect: 'gulf', topic: 'time' },
  { term: 'باجر', canonicalAr: 'غداً عاجل', canonicalEn: 'tomorrow urgent', dialect: 'gulf', topic: 'time' },
  { term: 'ابي خبير', canonicalAr: 'طلب استشارة خبير مراسم', canonicalEn: 'request protocol expert review', dialect: 'gulf', topic: 'expert' },
  { term: 'نبي دوره', canonicalAr: 'طلب برنامج تدريبي للمراسم', canonicalEn: 'request protocol training program', dialect: 'gulf', topic: 'training' },
  { term: 'بشت', canonicalAr: 'اللباس الرسمي الوطني المشلح', canonicalEn: 'formal national attire dress code', dialect: 'gulf', topic: 'dress' },
  { term: 'دشداشه', canonicalAr: 'الزي الوطني الرسمي الكويتي والخليجي', canonicalEn: 'formal national dress gulf', dialect: 'gulf', topic: 'dress' },
  { term: 'قعده الطاوله', canonicalAr: 'ترتيب الجلوس والأسبقية على الطاولة', canonicalEn: 'table seating arrangement precedence', dialect: 'gulf', topic: 'seating' },
  { term: 'ترتيب الكراسي', canonicalAr: 'ترتيب الجلوس والأسبقية', canonicalEn: 'seating precedence layout', dialect: 'msa', topic: 'seating' },
  { term: 'هديه', canonicalAr: 'تبادل الهدايا الرسمية وضوابطها', canonicalEn: 'official gift exchange compliance', dialect: 'msa', topic: 'gifts' },
  { term: 'مذكره تفاهم', canonicalAr: 'توقيع مذكرة تفاهم برنامج زيارة دعوة', canonicalEn: 'memorandum of understanding signing ceremony delegation', dialect: 'msa', topic: 'visit_program' },
  { term: 'معالي', canonicalAr: 'الألقاب الرسمية ومخاطبة الوزراء', canonicalEn: 'excellency ministerial official titles', dialect: 'msa', topic: 'titles' },
];

export function expandQueryWithSynonyms(
  rawQuery: string,
  extraSynonyms: DialectSynonym[] = [],
): { normalized: string; expandedTokens: string[]; detectedDialect: 'gulf' | 'msa' } {
  const normalized = normalizeArabic(rawQuery);
  const allSynonyms = [...DEFAULT_DIALECT_SYNONYMS, ...extraSynonyms];
  const extraParts: string[] = [];
  let detectedDialect: 'gulf' | 'msa' = 'msa';

  const gulfMarkers = ['شلون', 'شنو', 'باجر', 'ابي', 'نبي', 'حق', 'بكره', 'عندنا'];
  for (const marker of gulfMarkers) {
    if (normalized.includes(normalizeArabic(marker))) {
      detectedDialect = 'gulf';
      break;
    }
  }

  for (const syn of allSynonyms) {
    const normTerm = normalizeArabic(syn.term);
    if (normTerm && normalized.includes(normTerm)) {
      extraParts.push(normalizeArabic(syn.canonicalAr));
      extraParts.push(normalizeArabic(syn.canonicalEn));
      if (syn.dialect === 'gulf') {
        detectedDialect = 'gulf';
      }
    }
  }

  const combined = [normalized, ...extraParts].join(' ').trim();
  const expandedTokens = Array.from(
    new Set(combined.split(/\s+/).filter((tok) => tok.length >= 2)),
  );
  return { normalized, expandedTokens, detectedDialect };
}

/**
 * Deterministic 64-dimensional hashed character-trigram + token vector
 * used by the local/mock embedding provider so semantic similarity & duplicate
 * detection work deterministically with zero external network calls.
 */
export function computeDeterministicEmbedding(text: string, dims = 64): number[] {
  const norm = normalizeArabic(text);
  const vec = new Array<number>(dims).fill(0);
  if (!norm) return vec;

  // Token contribution
  const tokens = norm.split(/\s+/);
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dims;
    vec[idx] += 2.0;
  }

  // Character 3-gram contribution
  for (let i = 0; i <= norm.length - 3; i++) {
    const gram = norm.slice(i, i + 3);
    let h = 5381;
    for (let j = 0; j < 3; j++) {
      h = (h * 33) ^ gram.charCodeAt(j);
    }
    const idx = Math.abs(h) % dims;
    vec[idx] += 1.0;
  }

  const mag = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  if (mag === 0) return vec;
  return vec.map((v) => Number((v / mag).toFixed(5)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * WCAG 2.2 Relative Luminance & Contrast Ratio Calculator
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function calculateContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}
