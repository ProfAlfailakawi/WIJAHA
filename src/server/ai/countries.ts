import { normalizeArabic } from '../../shared/arabic.ts';

export interface CountryPattern {
  iso: string;
  ar: string;
  en: string;
  /** Tokens are matched as whole words (Arabic clitic prefixes and common nisba suffixes allowed). */
  tokens: string[];
  /** If this matches the normalized text, the pattern is ignored (e.g. "صلاة المغرب" is not Morocco). */
  exclude?: RegExp;
}

export const COUNTRY_PATTERNS: CountryPattern[] = [
  // Gulf (GCC)
  { iso: 'KW', ar: 'الكويت', en: 'Kuwait', tokens: ['كويت', 'kuwait', 'kuwaiti'] },
  { iso: 'SA', ar: 'السعودية', en: 'Saudi Arabia', tokens: ['سعوديه', 'سعودي', 'الرياض', 'جده', 'riyadh', 'jeddah', 'saudi', 'ksa'] },
  { iso: 'AE', ar: 'الإمارات', en: 'United Arab Emirates', tokens: ['امارات', 'اماراتي', 'ابوظبي', 'ابو ظبي', 'دبي', 'الشارقه', 'uae', 'emirates', 'emirati', 'dubai', 'abu dhabi', 'sharjah'] },
  { iso: 'QA', ar: 'قطر', en: 'Qatar', tokens: ['قطر', 'الدوحه', 'qatar', 'qatari', 'doha'] },
  { iso: 'BH', ar: 'البحرين', en: 'Bahrain', tokens: ['بحرين', 'المنامه', 'bahrain', 'bahraini', 'manama'] },
  // Jordan is listed before Oman: bare "عمان" is ambiguous once diacritics are removed (Amman / Oman).
  { iso: 'JO', ar: 'الأردن', en: 'Jordan', tokens: ['اردن', 'اردني', 'jordan', 'jordanian', 'amman'] },
  { iso: 'OM', ar: 'سلطنة عُمان', en: 'Oman', tokens: ['سلطنه عمان', 'عمان', 'مسقط', 'oman', 'omani', 'muscat'] },
  // Levant, Iraq, Egypt
  { iso: 'EG', ar: 'مصر', en: 'Egypt', tokens: ['مصر', 'القاهره', 'الاسكندريه', 'egypt', 'egyptian', 'cairo', 'alexandria'] },
  { iso: 'LB', ar: 'لبنان', en: 'Lebanon', tokens: ['لبنان', 'بيروت', 'lebanon', 'lebanese', 'beirut'] },
  { iso: 'IQ', ar: 'العراق', en: 'Iraq', tokens: ['عراق', 'بغداد', 'اربيل', 'iraq', 'iraqi', 'baghdad', 'erbil'] },
  { iso: 'SY', ar: 'سوريا', en: 'Syria', tokens: ['سوريا', 'دمشق', 'syria', 'syrian', 'damascus'] },
  { iso: 'PS', ar: 'فلسطين', en: 'Palestine', tokens: ['فلسطين', 'رام الله', 'palestine', 'palestinian', 'ramallah'] },
  // Maghreb and others
  {
    iso: 'MA',
    ar: 'المغرب',
    en: 'Morocco',
    tokens: ['المغرب', 'مغربي', 'المملكه المغربيه', 'الرباط', 'الدار البيضاء', 'morocco', 'moroccan', 'rabat', 'casablanca'],
    exclude: /(?:صلاه|اذان|بعد|قبل|عند|وقت|قبيل|اثناء)\s+(?:ال)?مغرب/u,
  },
  { iso: 'TN', ar: 'تونس', en: 'Tunisia', tokens: ['تونس', 'tunisia', 'tunisian', 'tunis'] },
  { iso: 'DZ', ar: 'الجزائر', en: 'Algeria', tokens: ['جزائر', 'جزائري', 'algeria', 'algerian', 'algiers'] },
  { iso: 'LY', ar: 'ليبيا', en: 'Libya', tokens: ['ليبيا', 'طرابلس', 'libya', 'libyan', 'tripoli'] },
  { iso: 'SD', ar: 'السودان', en: 'Sudan', tokens: ['سودان', 'الخرطوم', 'sudan', 'sudanese', 'khartoum'] },
  { iso: 'YE', ar: 'اليمن', en: 'Yemen', tokens: ['اليمن', 'يمني', 'صنعاء', 'yemen', 'yemeni'] },
  { iso: 'MR', ar: 'موريتانيا', en: 'Mauritania', tokens: ['موريتانيا', 'mauritania'] },
  { iso: 'SO', ar: 'الصومال', en: 'Somalia', tokens: ['صومال', 'somalia'] },
  { iso: 'DJ', ar: 'جيبوتي', en: 'Djibouti', tokens: ['جيبوتي', 'djibouti'] },
  { iso: 'KM', ar: 'جزر القمر', en: 'Comoros', tokens: ['جزر القمر', 'comoros'] },
  // Rest of the world already supported
  { iso: 'CN', ar: 'الصين', en: 'China', tokens: ['صين', 'بكين', 'china', 'chinese', 'beijing'] },
  { iso: 'PL', ar: 'بولندا', en: 'Poland', tokens: ['بولندا', 'بولندي', 'بولنديه', 'وارسو', 'poland', 'polish', 'warsaw'] },
  { iso: 'JP', ar: 'اليابان', en: 'Japan', tokens: ['يابان', 'طوكيو', 'japan', 'japanese', 'tokyo'] },
  { iso: 'GB', ar: 'المملكة المتحدة', en: 'United Kingdom', tokens: ['بريطانيا', 'بريطاني', 'لندن', 'انجلترا', 'uk', 'london', 'british'] },
  { iso: 'DE', ar: 'ألمانيا', en: 'Germany', tokens: ['المانيا', 'الماني', 'برلين', 'germany', 'german', 'berlin'] },
  { iso: 'FR', ar: 'فرنسا', en: 'France', tokens: ['فرنسا', 'فرنسي', 'باريس', 'france', 'french', 'paris'] },
  { iso: 'US', ar: 'الولايات المتحدة', en: 'United States', tokens: ['امريكا', 'امريكي', 'واشنطن', 'usa', 'american', 'washington'] },
  { iso: 'EU', ar: 'أوروبا', en: 'Europe', tokens: ['اوروب', 'europe', 'european'] },
  { iso: 'TR', ar: 'تركيا', en: 'Türkiye', tokens: ['تركيا', 'تركي', 'انقره', 'turkey', 'turkish', 'türkiye'] },
  { iso: 'IN', ar: 'الهند', en: 'India', tokens: ['الهند', 'هندي', 'دلهي', 'india', 'indian', 'delhi'] },
  { iso: 'KR', ar: 'كوريا', en: 'Korea', tokens: ['كوريا', 'كوري', 'سيول', 'korea', 'korean', 'seoul'] },
  { iso: 'BR', ar: 'البرازيل', en: 'Brazil', tokens: ['برازيل', 'برازيلي', 'brazil', 'brazilian'] },
  { iso: 'IT', ar: 'إيطاليا', en: 'Italy', tokens: ['ايطاليا', 'ايطالي', 'روما', 'italy', 'italian', 'rome'] },
  { iso: 'ES', ar: 'إسبانيا', en: 'Spain', tokens: ['اسبانيا', 'اسباني', 'مدريد', 'spain', 'spanish', 'madrid'] },
  { iso: 'MY', ar: 'ماليزيا', en: 'Malaysia', tokens: ['ماليزيا', 'ماليزي', 'malaysia', 'malaysian'] },
  { iso: 'RU', ar: 'روسيا', en: 'Russia', tokens: ['روسيا', 'روسي', 'موسكو', 'russia', 'russian', 'moscow'] },
  // Regional groups (lowest priority: a named country wins when mentioned first or tied)
  { iso: 'GCC', ar: 'دول الخليج', en: 'Gulf (GCC)', tokens: ['خليج', 'خليجي', 'مجلس التعاون', 'gcc', 'gulf'] },
  { iso: 'ARAB', ar: 'العالم العربي', en: 'Arab world', tokens: ['الدول العربيه', 'العالم العربي', 'الوطن العربي', 'arab world', 'arab countries'] },
];

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = COUNTRY_PATTERNS.map((c) => ({
  ...c,
  res: c.tokens.map(
    (t) =>
      new RegExp(
        `(?<![\\p{L}\\p{N}])(?:وال|بال|فال|كال|لل|ال|و|ب|ل|ك|ف)?${esc(normalizeArabic(t))}(?:ي|يه|يين|ين|ون|ات|ا|ه)?(?![\\p{L}\\p{N}])`,
        'u',
      ),
  ),
}));

/** Returns the country mentioned earliest in the text (ties follow list order), or undefined. */
export function detectCountry(norm: string): CountryPattern | undefined {
  let best: { idx: number; c: CountryPattern } | undefined;
  for (const c of compiled) {
    if (c.exclude?.test(norm)) continue;
    for (const re of c.res) {
      const m = re.exec(norm);
      if (m && (!best || m.index < best.idx)) {
        best = { idx: m.index, c };
      }
    }
  }
  return best?.c;
}
