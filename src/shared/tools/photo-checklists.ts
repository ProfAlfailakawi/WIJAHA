/** Guided photo review: checklists per photo type. The user inspects the photo and marks each item; nothing is uploaded. */

export type PhotoKind = 'hall' | 'table' | 'podium' | 'invitation';

export interface CheckItem {
  id: string;
  ar: string;
  en: string;
  whyAr: string;
  whyEn: string;
}

export const PHOTO_KINDS: Array<{ id: PhotoKind; ar: string; en: string }> = [
  { id: 'hall', ar: 'القاعة والجلوس', en: 'Hall and seating' },
  { id: 'table', ar: 'طاولة الطعام', en: 'Dining table' },
  { id: 'podium', ar: 'المنصة والأعلام', en: 'Podium and flags' },
  { id: 'invitation', ar: 'بطاقة الدعوة', en: 'Invitation card' },
];

export const CHECKLISTS: Record<PhotoKind, CheckItem[]> = {
  hall: [
    { id: 'h1', ar: 'الصف الأول للضيوف الأرفع رتبة', en: 'Highest-ranking guests are in the front row', whyAr: 'القرب من المنصة أو المضيف مؤشر مكانة.', whyEn: 'Proximity to the stage or host signals rank.' },
    { id: 'h2', ar: 'مسافات متساوية بين المقاعد', en: 'Even spacing between seats', whyAr: 'التفاوت يُقرأ كتفضيل أو إهمال.', whyEn: 'Uneven gaps read as favour or neglect.' },
    { id: 'h3', ar: 'ممرات واضحة ومخارج غير مسدودة', en: 'Clear aisles and unblocked exits', whyAr: 'سلامة وسهولة حركة الضيوف الكبار.', whyEn: 'Safety and easy movement for senior guests.' },
    { id: 'h4', ar: 'المقعد الأول للمضيف في موضع واضح', en: 'The host’s seat is clearly placed', whyAr: 'يُبنى الترتيب كله حوله.', whyEn: 'All ranking is built around it.' },
    { id: 'h5', ar: 'لا خلف الضيف الرفيع ما يشتت (مخرج، باب خدمة)', en: 'Nothing distracting behind the senior guest (service door, exit)', whyAr: 'الخلفية تظهر في الصور الرسمية.', whyEn: 'The background shows in official photos.' },
    { id: 'h6', ar: 'بطاقات الأسماء مقروءة من مسافة', en: 'Name cards are legible from a distance', whyAr: 'تمنع الارتباك والاحراج.', whyEn: 'Prevents confusion and embarrassment.' },
  ],
  table: [
    { id: 't1', ar: 'الأدوات من الخارج للداخل بترتيب الأطباق', en: 'Cutlery is laid outside-in in order of courses', whyAr: 'القاعدة المعتادة في الموائد الرسمية.', whyEn: 'Standard formal-table convention.' },
    { id: 't2', ar: 'الأكواب فوق السكين من جهة اليمين', en: 'Glasses are above the knife on the right', whyAr: 'ترتيب مألوف يسهّل الاستخدام.', whyEn: 'A familiar layout that eases use.' },
    { id: 't3', ar: 'المناديل نظيفة ومرتبة', en: 'Napkins are clean and neatly set', whyAr: 'أول انطباع عن العناية.', whyEn: 'First impression of care.' },
    { id: 't4', ar: 'بطاقة اسم أمام كل مقعد بخط واضح', en: 'A clear place card at every seat', whyAr: 'تنظّم الجلوس وتحفظ الرتبة.', whyEn: 'Organises seating and preserves rank.' },
    { id: 't5', ar: 'لا محظورات غذائية على المائدة (كالمحرّمات)', en: 'No forbidden foods or drinks on the table', whyAr: 'احترام معتقدات الضيوف.', whyEn: 'Respect for guests’ beliefs.' },
    { id: 't6', ar: 'تناسق الزهور والشموع دون حجب النظر', en: 'Flowers and candles do not block sightlines', whyAr: 'يجب أن يرى الضيوف بعضهم.', whyEn: 'Guests must see each other.' },
  ],
  podium: [
    { id: 'p1', ar: 'الأعلام على ارتفاع واحد وبنفس الحجم', en: 'Flags at equal height and size', whyAr: 'المساواة بين الدول قاعدة أساسية.', whyEn: 'Equality of states is a basic rule.' },
    { id: 'p2', ar: 'علم الدولة المضيفة في موضع الشرف المتفق عليه', en: 'Host-nation flag in the agreed place of honour', whyAr: 'يختلف بحسب البروتوكول المحلي، فتأكد.', whyEn: 'Varies by local protocol; confirm it.' },
    { id: 'p3', ar: 'الأعلام نظيفة وغير ممزقة ولا مجعدة', en: 'Flags are clean, untorn and unwrinkled', whyAr: 'العلم المتهالك إهانة.', whyEn: 'A worn flag is disrespectful.' },
    { id: 'p4', ar: 'العلم الوطني ليس أدنى من علم أجنبي', en: 'The national flag is never lower than a foreign one', whyAr: 'قاعدة شائعة في الأنظمة.', whyEn: 'Common rule in national flag regulations.' },
    { id: 'p5', ar: 'المنصة محايدة وشعار الجهة واضح', en: 'The podium is tidy with a clear organisation logo', whyAr: 'تُظهر الجهة بصورة لائقة.', whyEn: 'Presents the organisation properly.' },
    { id: 'p6', ar: 'كراسي المنصة بعدد المتحدثين وبترتيب الرتبة', en: 'Stage seats match the speakers and rank order', whyAr: 'تمنع الحرج أمام الجمهور.', whyEn: 'Prevents on-stage awkwardness.' },
  ],
  invitation: [
    { id: 'i1', ar: 'اسم الجهة المنظمة والمناسبة واضحان', en: 'Host and occasion are clearly named', whyAr: 'أساس الدعوة.', whyEn: 'The core of an invitation.' },
    { id: 'i2', ar: 'التاريخ واليوم والوقت والمكان كاملة', en: 'Date, day, time and place are complete', whyAr: 'نقص معلومة يربك الضيف.', whyEn: 'A missing detail confuses guests.' },
    { id: 'i3', ar: 'التاريخ الهجري مع الميلادي إن لزم', en: 'Hijri date alongside Gregorian where relevant', whyAr: 'معتاد في الجهات الرسمية الخليجية.', whyEn: 'Customary for Gulf official bodies.' },
    { id: 'i4', ar: 'الألقاب والأسماء صحيحة الإملاء وبالترتيب الصحيح', en: 'Titles and names correctly spelt and ordered', whyAr: 'الخطأ في اللقب حساس.', whyEn: 'A title error is sensitive.' },
    { id: 'i5', ar: 'زي الحضور مذكور', en: 'Dress code is stated', whyAr: 'يمنع الاختلاف في التوقعات.', whyEn: 'Avoids mismatched expectations.' },
    { id: 'i6', ar: 'وسيلة تأكيد الحضور (رقم أو بريد)', en: 'A way to confirm attendance', whyAr: 'يسهّل تخطيط الجلوس.', whyEn: 'Helps seating plans.' },
    { id: 'i7', ar: 'النسختان العربية والإنجليزية متطابقتان في المضمون', en: 'Arabic and English versions match in content', whyAr: 'تضارب النسختين محرج.', whyEn: 'Mismatched versions are embarrassing.' },
  ],
};

export type Mark = 'ok' | 'bad' | 'na';

export function scoreChecks(kind: PhotoKind, marks: Record<string, Mark>): { score: number; bad: CheckItem[]; answered: number; total: number } {
  const items = CHECKLISTS[kind];
  const answered = items.filter((i) => marks[i.id] && marks[i.id] !== 'na');
  const ok = answered.filter((i) => marks[i.id] === 'ok').length;
  return {
    score: answered.length ? Math.round((ok / answered.length) * 100) : 0,
    bad: items.filter((i) => marks[i.id] === 'bad'),
    answered: answered.length,
    total: items.length,
  };
}
