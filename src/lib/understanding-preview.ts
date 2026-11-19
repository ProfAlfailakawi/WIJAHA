/**
 * Instant, client-side preview of what the request is about, shown while typing.
 * It is a hint only: the server's understanding (model + rules) decides the real result.
 */
export type PreviewIcon =
  | 'delegation' | 'meal' | 'signing' | 'gift' | 'invite' | 'trip' | 'seating'
  | 'country' | 'count' | 'when' | 'venue' | 'level';

export interface PreviewChip {
  key: string;
  icon: PreviewIcon;
  label: string;
}

const COUNTRIES: Array<[RegExp, string, string]> = [
  [/الصين|صيني|china|chinese/i, 'الصين', 'China'],
  [/اليابان|ياباني|japan/i, 'اليابان', 'Japan'],
  [/كوري|كوريا|korea/i, 'كوريا', 'Korea'],
  [/الهند|هندي|india/i, 'الهند', 'India'],
  [/بولند|وارسو|poland|warsaw/i, 'بولندا', 'Poland'],
  [/فرنس|باريس|france|paris/i, 'فرنسا', 'France'],
  [/ألمان|المان|germany|berlin/i, 'ألمانيا', 'Germany'],
  [/بريطان|لندن|britain|london|\buk\b/i, 'بريطانيا', 'United Kingdom'],
  [/أمريك|امريك|واشنطن|america|\busa\b/i, 'الولايات المتحدة', 'United States'],
  [/تركي|اسطنبول|turkey|türkiye/i, 'تركيا', 'Türkiye'],
  [/السعودي|الرياض|saudi|riyadh/i, 'السعودية', 'Saudi Arabia'],
  [/الإمارات|الامارات|دبي|ابوظبي|أبوظبي|uae|dubai/i, 'الإمارات', 'UAE'],
  [/قطر|الدوحة|qatar|doha/i, 'قطر', 'Qatar'],
  [/مصر|القاهرة|egypt|cairo/i, 'مصر', 'Egypt'],
  [/الكويت|كويتي|kuwait/i, 'الكويت', 'Kuwait'],
];

const OCCASIONS: Array<[RegExp, PreviewIcon, string, string]> = [
  [/وفد|delegation/i, 'delegation', 'وفد زائر', 'Visiting delegation'],
  [/عشاء|عشا|غداء|غدا|عزيم|مائدة|dinner|lunch|banquet/i, 'meal', 'مأدبة', 'Formal meal'],
  [/مذكرة تفاهم|اتفاقي|توقيع|mou|agreement|signing/i, 'signing', 'توقيع اتفاقية', 'Signing'],
  [/هدي|gift/i, 'gift', 'هدية', 'Gift'],
  [/دعوة|invitation/i, 'invite', 'دعوة رسمية', 'Invitation'],
  [/زيارة عمل|نزور|بنزور|رحلة|سفر|business trip|visit to/i, 'trip', 'زيارة للخارج', 'Trip abroad'],
  [/جلوس|ترتيب|الطاولة|seating|precedence/i, 'seating', 'ترتيب جلوس', 'Seating'],
];

const VENUES: Array<[RegExp, string, string]> = [
  [/مطعم|restaurant/i, 'مطعم', 'Restaurant'],
  [/فندق|hotel/i, 'فندق', 'Hotel'],
  [/جامع|university|campus/i, 'جامعة', 'University'],
  [/شرك|company|corporate/i, 'شركة', 'Company'],
  [/وزار|حكوم|ministry|government/i, 'جهة حكومية', 'Government'],
];

const WHEN: Array<[RegExp, string, string]> = [
  [/بكرة|باجر|بكره|غدا|غداً|tomorrow/i, 'غداً', 'Tomorrow'],
  [/اليوم|الليلة|tonight|today/i, 'اليوم', 'Today'],
  [/الأسبوع القادم|الاسبوع الجاي|next week/i, 'الأسبوع القادم', 'Next week'],
];

const HIGH = /وزير|معالي|سفير|سفارة|رئيس دولة|سمو|ministe|ambassador|head of state|royal/i;

const toWestern = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export function previewUnderstanding(raw: string, locale: 'ar' | 'en'): PreviewChip[] {
  const text = toWestern(raw.trim());
  if (text.length < 4) return [];
  const ar = locale === 'ar';
  const chips: PreviewChip[] = [];

  const occ = OCCASIONS.find(([re]) => re.test(text));
  if (occ) chips.push({ key: 'occ', icon: occ[1], label: ar ? occ[2] : occ[3] });

  const country = COUNTRIES.find(([re]) => re.test(text));
  if (country) chips.push({ key: 'country', icon: 'country', label: ar ? country[1] : country[2] });

  const count = text.match(/(?:^|\s)(\d{1,4})\s*(?:شخص|اشخاص|أشخاص|ضيف|ضيوف|مشارك|people|guests|persons)?/);
  if (count && Number(count[1]) > 1) chips.push({ key: 'count', icon: 'count', label: ar ? `${count[1]} ضيوف` : `${count[1]} guests` });

  const when = WHEN.find(([re]) => re.test(text));
  if (when) chips.push({ key: 'when', icon: 'when', label: ar ? when[1] : when[2] });

  const venue = VENUES.find(([re]) => re.test(text));
  if (venue) chips.push({ key: 'venue', icon: 'venue', label: ar ? venue[1] : venue[2] });

  if (/vip|كبار|رفيع/i.test(text) || HIGH.test(text)) {
    chips.push({ key: 'level', icon: 'level', label: ar ? (HIGH.test(text) ? 'رفيع المستوى · مراجعة خبير' : 'كبار الضيوف') : HIGH.test(text) ? 'High level · expert review' : 'VIP guests' });
  }
  return chips;
}
