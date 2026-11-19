import { normalizeArabic } from '../../shared/arabic.ts';
import type { IntentType } from '../../shared/types.ts';

/**
 * Weighted lexicon classifier (Arabic MSA, Gulf dialect, English).
 * Input is the output of normalizeArabic(): lowercase, hamza/taa-marbuta/alef-maqsura unified.
 * Each hit adds its weight to an intent; the highest score wins; ties follow TIE_ORDER.
 * Deterministic on purpose: it is the offline fallback when no language model is available.
 */

// Whole-word match with optional Arabic clitic prefixes (ال، و، ب، ل، ك، ف).
const tok = (...words: string[]): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:وال|بال|فال|كال|لل|ال|و|ب|ل|ك|ف)?(?:${words.map(normalizeArabic).join('|')})(?![\\p{L}\\p{N}])`, 'u');
const sub = (...parts: string[]): RegExp => new RegExp(parts.map(normalizeArabic).join('|'), 'u');

type Rule = [RegExp, number];

const LEXICON: Partial<Record<IntentType, Rule[]>> = {
  expert_request: [
    [/(?:ابي|ابغي|ابغا|نبي|احتاج|نحتاج|اريد|نريد)\s+(?:\S+\s+){0,2}(?:خبير|مختص|استشار)/u, 5],
    [sub('ابي خبير', 'ابغي خبير', 'ابغا خبير', 'نبي خبير', 'احتاج خبير', 'احتاج مختص', 'خبير مراسم', 'خبير اداب', 'خبير بروتوكول', 'خبير ينسق', 'استشاره', 'مراجعه خبير', 'راي خبير', 'مختص في البروتوكول', 'مختصا في البروتوكول'), 5],
    [sub('protocol specialist', 'etiquette expert', 'expert opinion', 'specialist to review', 'expert to review', 'connect me with', 'book a consultation', 'protocol expert'), 5],
    [tok('خبير', 'خبراء', 'expert', 'specialist', 'consultant'), 2],
  ],
  training_request: [
    [sub('ندرب', 'نتدرب', 'تدريب', 'coaching', 'train our', 'train the', 'train staff', 'upskill'), 4],
    [sub('دوره تدريبيه', 'برنامج تدريبي', 'ورشه عمل', 'ورشه', 'نتدرب', 'تدريب', 'دوره', 'نبي دوره'), 4],
    [sub('training', 'workshop', 'training course', 'etiquette training'), 4],
  ],
  plan_review: [
    [sub('افحص', 'راجع', 'قيم', 'تدقيق', 'دقق', 'مراجعه'), 3],
    [sub('مراجعه مسوده'), 2],
    [sub('audit', 'review my', 'review the', 'please review', 'check this', 'evaluate', 'buffer timing', 'timing conflicts'), 3],
    [sub('خطتنا', 'خطتي', 'جدول', 'برنامج الزياره', 'مسوده برنامج', 'itinerary', 'schedule', 'visit plan', 'reception plan', 'protocol plan'), 1],
    [sub('مخاطر', 'تعارض', 'الناقص', 'risk', 'missing', 'conflict'), 1],
  ],
  formal_invitation: [
    [sub('اكتب دعوه', 'اكتب مسوده دعوه', 'نكتب دعوه', 'مسوده دعوه', 'صيغه دعوه', 'نص دعوه', 'نص بطاقه', 'بطاقه دعوه', 'ابغي مسوده دعوه', 'ابي مسوده دعوه', 'نحتاج نص'), 5],
    [sub('invitation letter', 'formal invitation', 'official invitation', 'write an invitation', 'draft an invitation', 'compose an invitation', 'draft a formal', 'write a formal'), 5],
    [sub('دعوه', 'invitation'), 1],
  ],
  gift_question: [
    [sub('هديه', 'هدايا', 'نهدي', 'اهداء', 'يهدي', 'اهدي'), 10],
    [tok('gift', 'gifts', 'present'), 10],
  ],
  seating_precedence: [
    [sub('وين مكان', 'اين مكان', 'مكان المترجم', 'interpreter', 'seat a', 'seat the'), 4],
    [sub('ترتيب الجلوس', 'نرتب الجلوس', 'الجلوس علي', 'ترتيب المقاعد', 'ترتيب الكراسي', 'توزيع المقاعد', 'نوزع المقاعد', 'يمين الضيف', 'قعده الطاوله', 'وين يقعد', 'من يجلس', 'يجلس علي', 'مقاعد', 'الكراسي', 'الاسبقي', 'اسبقي'), 6],
    [sub('seating', 'precedence', 'who sits', 'head of the table', 'interpreter sit', 'seat the', 'seat guests'), 6],
    [sub('المنصه', 'منصه'), 1],
  ],
  business_trip_abroad: [
    [sub('سنسافر', 'مسافرين', 'مسافر', 'نسافر', 'سفره عمل', 'سفر عمل', 'رحله عمل', 'زياره عمل', 'ذاهب الي', 'بنزور', 'بزور', 'سفرتنا', 'رايحين'), 4],
    [sub('traveling to', 'travelling to', 'business trip', 'business travel', 'trip to', 'travel to', 'visiting business partners', 'abroad'), 4],
  ],
  greeting_titles: [
    [sub('كيف نبدا رساله', 'نبدا رساله', 'بطاقات الاسماء', 'بطاقه الاسماء', 'اكتب لقب', 'مخاطبه', 'start a letter', 'name cards', 'place cards'), 4],
    [sub('نخاطب', 'اخاطب', 'مخاطبه', 'بماذا نخاطب', 'لقب', 'القاب', 'تحيه', 'نحيي', 'بطاقه الطاوله', 'بطاقه الاسم', 'كرت الاسم', 'شنو نقول حق', 'اسم الضيف علي'), 4],
    [sub('address a', 'how do i address', 'how should we address', 'form of address', 'forms of address', 'titles and', 'salutation', 'greet a', 'way to greet', 'correct way to greet'), 4],
  ],
  cultural_briefing: [
    [sub('ثقافه', 'ثقافيه', 'ثقافيا', 'العادات', 'التقاليد', 'عادات', 'نبذه'), 4],
    [sub('cultural', 'customs', 'business culture', 'culture of', 'cultural briefing'), 4],
  ],
  dress_code: [
    [sub('اللباس', 'لباس', 'ملابس', 'بشت', 'دريس', 'ارتدي', 'البس', 'لبس'), 5],
    [sub('dress code', 'what should i wear', 'attire', 'black tie', 'dress for'), 4],
    [tok('wear', 'suit', 'زي'), 3],
  ],
  hosting_hospitality: [
    [sub('vip guests', 'staff greet'), 4],
    [sub('ضيافه', 'مطعم', 'مادبه', 'ماءدبه', 'حجزنا', 'ضيوف مهمين', 'ضيوف علي', 'نجهز مادبه', 'نسدد الفاتوره', 'بالمطعم'), 4],
    [sub('hosting', 'hospitality', 'restaurant', 'catering', 'host guests', 'we are hosting', 'host clients'), 4],
    [sub('ضيوف', 'ضيف', 'نستقبل'), 2],
  ],
  delegation_visit_host: [
    [/(?:وزير|معالي|سفير|رييس دوله|minister|ambassador|head of state)[\s\S]{0,30}(?:جاي|جايي|يزور|يوصل|يحضر|قادم|visiting|arriving|coming|visit)/u, 5],
    [sub('reception programme', 'reception program', 'hosting a minister', 'hosting the head of state', 'hosting an ambassador', 'hosting a delegation', 'are coming', 'coming next week', 'professors are', 'to sign an agreement'), 5],
    [sub('خطه استقبال', 'برنامج استقبال', 'برنامج زياره', 'جدول الاستقبال', 'مذكره تفاهم', 'وفد اكاديمي', 'وفد جامعي', 'يزورنا', 'بيزورنا', 'ننتظر وفد', 'زياره وفد', 'يزور المؤسسه', 'يزور الوزاره'), 4],
    [sub('reception plan', 'welcome program', 'visiting delegation', 'delegation is visiting', 'host them', 'academic delegation', 'sign an mou', 'visiting government', 'visiting officials', 'delegation from'), 4],
    [sub('وفد', 'وفود', 'delegation'), 3],
  ],
  dining_etiquette: [
    [sub('عشاء رسمي', 'المنديل', 'منديل', 'الشوكه', 'السكين', 'ملعقه', 'الشوربه', 'اكل', 'ناكل', 'اتناول', 'تناول الطعام', 'وليمه', 'ادوات المائده'), 3],
    [sub('table manners', 'formal dinner', 'formal meal', 'flatware', 'napkin', 'bread plate', 'wine glass', 'fork', 'knife', 'soup', 'formal corporate dinner', 'formal business dinner', 'seven course'), 3],
    [sub('عشاء', 'غداء', 'مائده', 'dinner', 'lunch'), 2],
  ],
  etiquette_personal: [
    [sub('كروت شغل', 'كرت شغل', 'كروت عمل', 'بطاقات عمل', 'business cards'), 6],
    [sub('بطاقه العمل', 'بطاقه اعمال', 'business card', 'استلام وتقديم', 'وصل مبكر', 'وصل متاخر', 'شنو نسوي', 'ماذا نفعل اذا', 'what if', 'اذا حصل'), 4],
    [sub('اتيكيت', 'اداب', 'لباقه', 'اتصرف', 'تصرف', 'اتحدث', 'الحديث مع', 'اقدم نفسي', 'ارد علي', 'نغادر', 'ازعاج'), 2],
    [sub('etiquette', 'manners', 'politely', 'introduce myself', 'networking', 'right way to behave'), 2],
  ],
};

export const TIE_ORDER: IntentType[] = [
  'expert_request',
  'training_request',
  'plan_review',
  'formal_invitation',
  'gift_question',
  'seating_precedence',
  'business_trip_abroad',
  'greeting_titles',
  'cultural_briefing',
  'dress_code',
  'hosting_hospitality',
  'delegation_visit_host',
  'dining_etiquette',
  'etiquette_personal',
];

export function classifyIntent(norm: string): { intent: IntentType; score: number } {
  let best: IntentType = 'etiquette_personal';
  let bestScore = 0;
  for (const intent of TIE_ORDER) {
    let score = 0;
    for (const [re, w] of LEXICON[intent] ?? []) {
      if (re.test(norm)) score += w;
    }
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  // A single weak hint (score 1, e.g. just the word "schedule") is not enough to leave the general etiquette intent.
  if (bestScore < 2) return { intent: 'etiquette_personal', score: bestScore };
  return { intent: best, score: bestScore };
}

/** Clearly non-protocol requests: finance, weather, sports, code, recipes, translation. */
export const OUT_OF_SCOPE_RE = new RegExp(
  [
    'سعر الذهب', 'سعر الدولار', 'سعر الفضه', 'سعر النفط', 'حاله الطقس', 'مباراه كره',
    'bitcoin', 'crypto', 'stock price', 'football score', 'football match', 'weather', 'recipe', 'python code', 'javascript',
    'كود بايثون', 'كود برمجي', 'اكتب لي كود', tok('بايثون', 'طقس', 'مباراه', 'وصفه', 'البورصه', 'بورصه', 'اسهم', 'stocks?').source,
    'ترجم لي هذا', 'ترجم هذا', 'ترجم النص', 'translate this', 'translate the following', 'translate the text', 'رايك بالسياسه', 'السياسه الخارجيه', 'political opinion', 'who should i vote',
  ].join('|'),
  'u',
);

/** Requests to stereotype or rank people by nationality/religion/race: refused as unsafe. */
export const UNSAFE_RE =
  /(?:اسوا|اكثر|اقل|ابخل|اوقح|اكسل)[\s\S]{0,25}(?:جنسيه|شعب|دين|عرق)|(?:جنسيه|شعب|ديانه)[\s\S]{0,25}(?:وقح|كسول|بخيل|غبي|متخلف)|rudest|which nationality|which nationalities|stereotype|which religion is|inferior race/u;

/** Drop negated mentions ("skip expert review", "بدون مراجعة خبير") so they do not trigger expert_request. */
export function stripNegatedMentions(norm: string): string {
  return norm.replace(
    /(?:بدون|لا\s+\S+|ما\s+نبي|skip|without|do not|don t|dont|no)\s+(?:\S+\s+){0,2}(?:خبير|مراجعه|expert|review)\S*/gu,
    ' ',
  );
}

/** Royalty and heads of government: always high sensitivity (expert review recommended). */
export const ROYAL_HIGH_RE = tok(
  'صاحب السمو', 'سمو', 'صاحب الجلاله', 'جلاله الملك', 'جلاله', 'ولي العهد', 'خادم الحرمين', 'الديوان الاميري', 'الديوان الملكي',
  'الامير', 'امير', 'ملك', 'سلطان', 'رئيس الوزراء', 'رئيس الجمهوريه', 'فخامه', 'دوله الرئيس', 'رئيس مجلس الوزراء',
  'crown prince', 'king', 'sultan', 'emir', 'amir', 'prime minister', 'royal court', 'amiri diwan', 'royal highness', 'his highness', 'his majesty',
);
