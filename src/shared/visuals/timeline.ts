import { normalizeArabic } from '../arabic.ts';

export type TimelineKind =
  | 'arrival'
  | 'welcome'
  | 'coffee'
  | 'meeting'
  | 'meal'
  | 'prayer'
  | 'gift'
  | 'photo'
  | 'signing'
  | 'transfer'
  | 'departure'
  | 'rest'
  | 'generic';

const RULES: Array<[TimelineKind, RegExp]> = [
  ['prayer', /صلاه|مصلي|اذان|prayer|salah/u],
  ['signing', /توقيع|مذكره تفاهم|اتفاقيه|sign(ing)?\b|mou\b|agreement/u],
  ['photo', /صوره|تصوير|photo|picture/u],
  ['gift', /هديه|هدايا|gift/u],
  ['meal', /غداء|عشاء|مادبه|وليمه|افطار|سحور|lunch|dinner|banquet|meal|iftar|suhoor/u],
  ['coffee', /قهوه|ضيافه|شاي|تمر|coffee|refreshment|tea\b|hospitality/u],
  ['transfer', /انتقال|موكب|سياره|سيارات|نقل|transfer|motorcade|transport|convoy/u],
  ['departure', /مغادره|وداع|توديع|عوده|depart|farewell|leave|send-?off/u],
  ['arrival', /وصول|مطار|هبوط|arriv|airport|landing/u],
  ['welcome', /استقبال|ترحيب|سلام|welcome|reception|greet/u],
  ['meeting', /اجتماع|مباحثات|لقاء|جلسه|meeting|talks|session|briefing/u],
  ['rest', /راحه|استراحه|rest\b|break\b/u],
];

/** Picks an icon category for a programme item from its title (Arabic or English). */
export function inferTimelineKind(text: string): TimelineKind {
  const n = normalizeArabic(text);
  for (const [kind, re] of RULES) if (re.test(n)) return kind;
  return 'generic';
}
