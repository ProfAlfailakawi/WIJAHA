/** Learning path and exam questions. The exam answer key lives only on the server (src/server/certificate). */

export interface Module {
  id: string;
  ar: string;
  en: string;
  pointsAr: string[];
  pointsEn: string[];
}

export const MODULES: Module[] = [
  {
    id: 'm1', ar: 'الاستقبال والمصافحة', en: 'Reception and greeting',
    pointsAr: ['الضيف الأرفع رتبة يصل أخيراً بعد جلوس بقية المدعوين.', 'يُستقبل الكبير واقفاً وبالمصافحة باليد اليمنى مع ابتسامة واحترام، وتنتظر من الجنس الآخر أن يبادر بمد يده.', 'يرافق المضيف الضيف إلى مقعده ولا يتركه واقفاً.'],
    pointsEn: ['The most senior guest arrives last, after other invitees are seated.', 'Greet a senior person standing, with the right hand, and wait for a person of the other gender to extend a hand first.', 'The host escorts the guest to the seat and never leaves them standing.'],
  },
  {
    id: 'm2', ar: 'الألقاب والمخاطبة', en: 'Titles and address',
    pointsAr: ['يُخاطب الوزير بـ«معالي»، والسفير ووكيل الوزارة عادة بـ«سعادة»، والأمير بـ«سمو» بحسب مرتبته.', 'تحقق من اللقب الصحيح من مكتب الضيف قبل الطباعة.', 'عند الخطأ: اعتذار قصير وتصحيح هادئ دون إطالة.'],
    pointsEn: ['Address a minister as “Maali”, ambassadors and under-secretaries typically as “Saadat”, princes as “Samou” by rank.', 'Confirm the correct title with the guest’s office before printing.', 'If you slip: a short apology and a calm correction.'],
  },
  {
    id: 'm3', ar: 'الجلوس والأسبقية', en: 'Seating and precedence',
    pointsAr: ['المقعد الأشرف للضيف الرئيسي عادة عن يمين المضيف.', 'بطاقات الأسماء تنظم الجلوس وتحفظ الرتبة.', 'قبل الفعالية اعتمد القائمة مع الجهة؛ ولا تُغيّر مقعداً معتمداً أمام الحضور.'],
    pointsEn: ['The place of honour for the principal guest is usually to the host’s right.', 'Place cards organise seating and preserve rank.', 'Agree the list in advance; never change an approved seat in front of guests.'],
  },
  {
    id: 'm4', ar: 'الأعلام والمنصة', en: 'Flags and podium',
    pointsAr: ['الأعلام المتعددة تكون بحجم وارتفاع متساويين.', 'يجب ألا يكون العلم الوطني أدنى من علم أجنبي.', 'ترتيب الأعلام يُتفق عليه (أبجدي غالباً) مع الجهة المضيفة.'],
    pointsEn: ['Multiple flags are of equal size and height.', 'The national flag must never be lower than a foreign flag.', 'Flag order is agreed with the host (often alphabetical).'],
  },
  {
    id: 'm5', ar: 'الضيافة الخليجية', en: 'Gulf hospitality',
    pointsAr: ['تُقدَّم القهوة العربية للأكبر مكانة أولاً، وتُؤخذ وتُناول باليد اليمنى.', 'لا يُوجَّه باطن القدم إلى الآخرين في المجلس.', 'الهدية مناسبة وفق سياسة الجهة، دون مبالغة.'],
    pointsEn: ['Arabic coffee is served first to the most senior person, and taken and offered with the right hand.', 'Do not point the soles of your feet at others in a majlis.', 'Gifts should fit the organisation’s policy, without excess.'],
  },
  {
    id: 'm6', ar: 'التخطيط والطوارئ', en: 'Planning and incidents',
    pointsAr: ['الدعوة تتضمن الجهة والمناسبة والتاريخ والوقت والمكان والزي وطريقة التأكيد.', 'إذا تأخر الضيف الرئيسي فلا تبدأ الفقرة الرسمية قبله وعدّل الجدول.', 'التاريخ الهجري قد يختلف يوماً بحسب رؤية الهلال، فتحقق قبل الإرسال في المناسبات الدينية، وراعِ رمضان وأوقات الإفطار.', 'تحقق من سياسة التصوير قبل تصوير الضيوف الكبار.'],
    pointsEn: ['An invitation includes host, occasion, date, time, place, dress code and how to confirm.', 'If the principal guest is late, do not start the formal item before arrival; adjust the schedule.', 'Hijri dates can differ by a day with moon sighting: verify before sending for religious occasions, and respect Ramadan and iftar times.', 'Check the photography policy before photographing senior guests.'],
  },
];

export interface ExamQuestion {
  id: string;
  module: string;
  ar: string;
  en: string;
  optionsAr: string[];
  optionsEn: string[];
}

export const EXAM: ExamQuestion[] = [
  { id: 'q1', module: 'm1', ar: 'الضيف الأرفع رتبة يصل عادة:', en: 'The most senior guest normally arrives:', optionsAr: ['قبل الجميع بساعة', 'أخيراً بعد جلوس بقية المدعوين', 'في أي وقت دون ترتيب', 'قبل المضيف'], optionsEn: ['An hour before everyone', 'Last, after the other invitees are seated', 'Any time, no order', 'Before the host'] },
  { id: 'q2', module: 'm1', ar: 'عند استقبال شخصية خليجية كبيرة تفعل:', en: 'When greeting a senior Gulf figure you:', optionsAr: ['تقف وتصافح باليد اليمنى باحترام', 'تبقى جالساً', 'تصافح باليد اليسرى', 'تكتفي بالإشارة من بعيد'], optionsEn: ['Stand and shake with the right hand respectfully', 'Stay seated', 'Shake with the left hand', 'Just wave from afar'] },
  { id: 'q3', module: 'm2', ar: 'يُخاطب الوزير في المراسلات والمجالس الخليجية بـ:', en: 'A minister is addressed in Gulf correspondence and gatherings as:', optionsAr: ['يا فلان', 'معالي', 'الأخ فقط', 'بالاسم المجرد'], optionsEn: ['By first name', '“Maali” (Excellency)', 'Just “brother”', 'The bare name'] },
  { id: 'q4', module: 'm2', ar: 'ارتكبت خطأ في لقب الضيف أمام الحضور، فالأفضل:', en: 'You got a guest’s title wrong in public. Best:', optionsAr: ['تجاهل الخطأ', 'اعتذار قصير وتصحيح هادئ', 'إلقاء اللوم على المطبعة بصوت عال', 'تكرار الخطأ حتى يعتاد'], optionsEn: ['Ignore it', 'A short apology and calm correction', 'Loudly blame the printer', 'Repeat it until it sounds right'] },
  { id: 'q5', module: 'm3', ar: 'المقعد الأشرف للضيف الرئيسي عادة:', en: 'The place of honour for the principal guest is usually:', optionsAr: ['عن يمين المضيف', 'عن يسار المضيف', 'أبعد مقعد', 'أمام الباب'], optionsEn: ['To the host’s right', 'To the host’s left', 'The farthest seat', 'Facing the door'] },
  { id: 'q6', module: 'm3', ar: 'فائدة بطاقات الأسماء على المائدة الرسمية:', en: 'Place cards at a formal table serve to:', optionsAr: ['الزينة فقط', 'تنظيم الجلوس وحفظ الرتبة', 'تقليل عدد المدعوين', 'لا فائدة'], optionsEn: ['Decorate only', 'Organise seating and preserve rank', 'Reduce guest numbers', 'Nothing'] },
  { id: 'q7', module: 'm3', ar: 'ظهر خلاف على مقعد بين ضيفين، فالتصرف الصحيح:', en: 'Two guests dispute a seat. The right move:', optionsAr: ['مناقشة الأسبقية أمام الجميع', 'الرجوع للقائمة المعتمدة والحديث بهدوء على انفراد', 'إجلاس الأعلى صوتاً في الصدارة', 'إلغاء الفعالية'], optionsEn: ['Debate precedence publicly', 'Refer to the approved list and speak quietly in private', 'Seat the loudest in front', 'Cancel the event'] },
  { id: 'q8', module: 'm4', ar: 'الأعلام المتعددة في لقاء رسمي تكون:', en: 'Multiple flags at an official meeting are:', optionsAr: ['علم الضيف أكبر دائماً', 'متساوية الحجم والارتفاع', 'بلا ترتيب ولا اتفاق', 'علم الدولة أدنى ارتفاعاً'], optionsEn: ['The guest’s flag always larger', 'Equal in size and height', 'Random with no agreement', 'The national flag lower'] },
  { id: 'q9', module: 'm4', ar: 'العلم الوطني بالنسبة لعلم أجنبي:', en: 'The national flag relative to a foreign flag is:', optionsAr: ['ليس أدنى منه', 'دائماً أدنى منه', 'يُحذف', 'يُلف بقماش'], optionsEn: ['Never lower than it', 'Always lower', 'Removed', 'Wrapped in cloth'] },
  { id: 'q10', module: 'm5', ar: 'تُقدَّم القهوة العربية:', en: 'Arabic coffee is served:', optionsAr: ['للأصغر أولاً', 'للأكبر مكانة أولاً وتُؤخذ باليمنى', 'باليد اليسرى', 'بلا ترتيب'], optionsEn: ['To the youngest first', 'To the most senior first, taken with the right hand', 'With the left hand', 'In no order'] },
  { id: 'q11', module: 'm5', ar: 'من آداب المجلس:', en: 'A courtesy in a majlis:', optionsAr: ['توجيه باطن القدم نحو الآخرين', 'تجنب توجيه باطن القدم إلى أحد', 'مد الرجلين أمام الضيف', 'الاستلقاء'], optionsEn: ['Pointing the soles at others', 'Avoiding pointing the soles at anyone', 'Stretching legs towards the guest', 'Lying down'] },
  { id: 'q12', module: 'm5', ar: 'الهدية لشخصية رسمية:', en: 'A gift to an official figure should be:', optionsAr: ['نقداً دائماً', 'مناسبة وفق سياسة الجهة وبلا مبالغة', 'غالية جداً دائماً', 'ممنوعة دائماً'], optionsEn: ['Always cash', 'Appropriate under the organisation’s policy, without excess', 'Always very expensive', 'Always forbidden'] },
  { id: 'q13', module: 'm6', ar: 'تأخر الضيف الرئيسي، فتفعل:', en: 'The principal guest is late. You:', optionsAr: ['تبدأ الفقرة الرسمية فوراً', 'لا تبدأ الرسمي قبله وتعدّل الجدول', 'تلغي الفعالية', 'تغلق الأبواب'], optionsEn: ['Start the formal item immediately', 'Hold the formal part and adjust the schedule', 'Cancel the event', 'Lock the doors'] },
  { id: 'q14', module: 'm6', ar: 'قبل تصوير ضيف رفيع في فعالية رسمية:', en: 'Before photographing a senior guest at an official event:', optionsAr: ['تصوّر دون سؤال', 'تتحقق من سياسة التصوير وإذن الجهة', 'تنشر فوراً', 'تطلب منه التصوير'], optionsEn: ['Photograph without asking', 'Check the photography policy and permission', 'Post immediately', 'Ask them to pose'] },
  { id: 'q15', module: 'm6', ar: 'في الرسائل الرسمية للمناسبات الدينية الهجرية:', en: 'For official messages about Hijri religious occasions:', optionsAr: ['تعتمد تاريخاً واحداً دون تحقق', 'تتحقق لأن التاريخ قد يختلف يوماً بحسب رؤية الهلال', 'تتجاهل التاريخ', 'تستخدم التاريخ الميلادي فقط دائماً'], optionsEn: ['Rely on one date without checking', 'Verify, since it can differ by a day with moon sighting', 'Ignore the date', 'Always use Gregorian only'] },
];

export const PASS_MARK = 12;
