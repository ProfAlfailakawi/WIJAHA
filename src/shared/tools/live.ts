/** Protocol LIVE: event-day run sheet, live status and emergency playbooks. Pure and free; runs in the browser. */

export interface StepDef {
  /** Minutes from the event start (negative = before). */
  at: number;
  mins: number;
  ar: string;
  en: string;
  noteAr?: string;
  noteEn?: string;
}

export interface Template {
  id: string;
  ar: string;
  en: string;
  steps: StepDef[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'official-reception',
    ar: 'استقبال رسمي لضيف رفيع',
    en: 'Official reception of a senior guest',
    steps: [
      { at: -90, mins: 30, ar: 'جاهزية القاعة والمداخل', en: 'Hall and entrances ready', noteAr: 'راجع اللافتات والأعلام والإضاءة والصوت.', noteEn: 'Check signage, flags, lighting and sound.' },
      { at: -60, mins: 30, ar: 'إحاطة فريق الاستقبال', en: 'Briefing the reception team', noteAr: 'الأسماء والألقاب ومن يستقبل من وأين يقف كل شخص.', noteEn: 'Names, titles, who greets whom and where each person stands.' },
      { at: -30, mins: 20, ar: 'وصول المدعوين وجلوسهم قبل الضيف الرئيسي', en: 'Invitees arrive and are seated before the principal guest', noteAr: 'الضيف الأرفع يصل أخيراً.', noteEn: 'The most senior guest arrives last.' },
      { at: -10, mins: 10, ar: 'الاصطفاف عند المدخل', en: 'Line-up at the entrance' },
      { at: 0, mins: 10, ar: 'وصول الضيف الرئيسي والاستقبال والسلام', en: 'Principal guest arrives: welcome and greeting' },
      { at: 10, mins: 10, ar: 'الاصطحاب إلى مقعده', en: 'Escort to the seat' },
      { at: 20, mins: 40, ar: 'الاجتماع أو الكلمات', en: 'Meeting or speeches' },
      { at: 60, mins: 20, ar: 'ضيافة وصور تذكارية', en: 'Refreshments and group photo' },
      { at: 80, mins: 15, ar: 'التوديع حتى السيارة', en: 'Farewell to the car' },
    ],
  },
  {
    id: 'conference',
    ar: 'مؤتمر بجلسة افتتاح',
    en: 'Conference with an opening session',
    steps: [
      { at: -120, mins: 60, ar: 'تجهيز المسرح والمنصة وبطاقات الأسماء', en: 'Stage, podium and name cards set', noteAr: 'تحقق من ترتيب الأعلام وكراسي المنصة.', noteEn: 'Verify flag order and podium seating.' },
      { at: -60, mins: 45, ar: 'التسجيل واستقبال الضيوف', en: 'Registration and guest arrival' },
      { at: -15, mins: 15, ar: 'جلوس الحضور وإحضار كبار الضيوف إلى المنصة', en: 'Audience seated; senior guests brought to the podium' },
      { at: 0, mins: 5, ar: 'بدء الحفل والنشيد أو التلاوة', en: 'Start: anthem or recitation' },
      { at: 5, mins: 10, ar: 'كلمة الترحيب', en: 'Welcome remarks' },
      { at: 15, mins: 20, ar: 'كلمة راعي الحفل', en: 'Keynote by the patron' },
      { at: 35, mins: 10, ar: 'التكريم وتبادل الدروع', en: 'Honours and gift exchange' },
      { at: 45, mins: 15, ar: 'جولة المعرض أو استراحة', en: 'Exhibition tour or break' },
    ],
  },
  {
    id: 'dinner',
    ar: 'مأدبة عشاء رسمية',
    en: 'Formal dinner',
    steps: [
      { at: -60, mins: 30, ar: 'مراجعة الطاولات وبطاقات الأسماء والقوائم', en: 'Check tables, place cards and menus', noteAr: 'راعِ القيود الغذائية.', noteEn: 'Respect dietary restrictions.' },
      { at: -30, mins: 30, ar: 'استقبال الضيوف والمشروبات الترحيبية', en: 'Guests arrive; welcome drinks' },
      { at: 0, mins: 10, ar: 'دعوة الضيوف إلى الطاولات', en: 'Invite guests to the tables' },
      { at: 10, mins: 10, ar: 'كلمة المضيف', en: 'Host welcome' },
      { at: 20, mins: 60, ar: 'تقديم الطعام', en: 'Dinner service' },
      { at: 80, mins: 10, ar: 'كلمة الضيف الرئيسي أو نخب المناسبة', en: 'Guest-of-honour remarks' },
      { at: 90, mins: 30, ar: 'القهوة والتوديع', en: 'Coffee and farewells' },
    ],
  },
];

export interface Step extends StepDef {
  start: Date;
  end: Date;
  index: number;
}

export function buildSchedule(template: Template, eventStart: Date, shiftMin = 0): Step[] {
  return template.steps.map((s, index) => {
    const start = new Date(eventStart.getTime() + (s.at + shiftMin) * 60_000);
    return { ...s, start, end: new Date(start.getTime() + s.mins * 60_000), index };
  });
}

/** Delay only the steps that have not started yet (the step in progress keeps its start, ends later). */
export function applyDelay(steps: Step[], now: Date, delayMin: number): Step[] {
  const ms = delayMin * 60_000;
  return steps.map((s) => {
    if (s.start.getTime() > now.getTime()) return { ...s, start: new Date(s.start.getTime() + ms), end: new Date(s.end.getTime() + ms) };
    if (s.end.getTime() > now.getTime()) return { ...s, end: new Date(s.end.getTime() + ms) };
    return s;
  });
}

export interface LiveStatus {
  phase: 'before' | 'running' | 'between' | 'done';
  current: Step | null;
  next: Step | null;
  secondsToNext: number | null;
  secondsLeftInCurrent: number | null;
  progress: number;
}

export function statusAt(steps: Step[], now: Date): LiveStatus {
  const t = now.getTime();
  if (steps.length === 0) return { phase: 'done', current: null, next: null, secondsToNext: null, secondsLeftInCurrent: null, progress: 1 };
  const current = steps.find((s) => s.start.getTime() <= t && t < s.end.getTime()) ?? null;
  const next = steps.find((s) => s.start.getTime() > t) ?? null;
  const first = steps[0].start.getTime();
  const last = Math.max(...steps.map((s) => s.end.getTime()));
  const progress = Math.min(1, Math.max(0, (t - first) / Math.max(1, last - first)));
  const phase: LiveStatus['phase'] = t < first ? 'before' : t >= last ? 'done' : current ? 'running' : 'between';
  return {
    phase,
    current,
    next,
    secondsToNext: next ? Math.round((next.start.getTime() - t) / 1000) : null,
    secondsLeftInCurrent: current ? Math.round((current.end.getTime() - t) / 1000) : null,
    progress,
  };
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.abs(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export interface Emergency {
  id: string;
  ar: string;
  en: string;
  stepsAr: string[];
  stepsEn: string[];
  /** Minutes to push the remaining run sheet, when the incident normally causes a delay. */
  delay?: number;
}

export const EMERGENCIES: Emergency[] = [
  {
    id: 'vip-late',
    ar: 'تأخر الضيف الرئيسي',
    en: 'Principal guest is late',
    delay: 10,
    stepsAr: [
      'تواصل مع مرافق الضيف أو مكتبه واعرف الوقت المتوقع للوصول.',
      'لا تبدأ الفقرة الرسمية قبل وصوله؛ أبقِ الحضور مشغولين بالضيافة أو بفقرة قصيرة غير رسمية.',
      'أخبر المضيف بالتأخر المتوقع بهدوء وليس على الملأ.',
      'أزِح بقية الجدول بالمدة المتوقعة، وقلّص الفقرات الأقل أهمية بدل اختصار الاستقبال.',
    ],
    stepsEn: [
      'Contact the guest’s escort or office for an expected arrival time.',
      'Do not start the formal part before arrival; keep the audience occupied with refreshments or a short informal item.',
      'Tell the host quietly, not publicly.',
      'Push the rest of the run sheet by the expected delay and trim low-priority items rather than shortening the welcome.',
    ],
  },
  {
    id: 'unannounced-guest',
    ar: 'وصل ضيف غير مدرج في القائمة',
    en: 'An unlisted guest arrives',
    stepsAr: [
      'رحّب به أولاً بلطف ولا تُشعره بأنه غير مدعو.',
      'اعرف منصبه ومن دعاه، وأبلغ منسق الجلوس بهدوء.',
      'خصّص له مقعداً يتناسب مع منصبه من الاحتياطي، ولا تُزِح أحداً من مقعده المعتمد.',
      'حدّث بطاقة الاسم وقائمة التقديم إن كان سيُقدَّم.',
    ],
    stepsEn: [
      'Welcome the person warmly first; never make them feel uninvited.',
      'Find out their position and who invited them; quietly alert the seating coordinator.',
      'Seat them from the reserve in line with their rank; do not move anyone from an approved seat.',
      'Update the place card and the announcer’s list if they will be introduced.',
    ],
  },
  {
    id: 'host-absent',
    ar: 'غياب المضيف أو انشغاله',
    en: 'The host is absent or occupied',
    delay: 5,
    stepsAr: [
      'حدّد من ينوب عن المضيف بحسب التسلسل المعتمد في الجهة.',
      'أبلغ الضيف الرئيسي بالنائب واحتفظ بالمقعد الأول للمضيف دون إشغاله.',
      'لا تغيّر ترتيب الجلوس بالكامل؛ يتغيّر المقعد الأول فقط عند الضرورة.',
    ],
    stepsEn: [
      'Identify the deputy according to the organisation’s approved order.',
      'Tell the principal guest who is deputising and keep the host’s seat unoccupied.',
      'Do not reshuffle the whole seating; only the first seat changes if necessary.',
    ],
  },
  {
    id: 'seat-dispute',
    ar: 'خلاف على المقعد بين ضيفين',
    en: 'Two guests dispute a seat',
    stepsAr: [
      'لا تناقش الأسبقية أمام الحضور؛ اطلب من أحدهما الحديث على انفراد بلطف.',
      'ارجع إلى القائمة المعتمدة مسبقاً وليس إلى رأيك اللحظي.',
      'إن تعذّر الحل فاعرض مقعداً مماثلاً في المرتبة، واعتذر عن الإرباك.',
      'سجّل ما حدث لتحسين المخطط في المرة القادمة.',
    ],
    stepsEn: [
      'Never debate precedence in front of others; take one of them aside politely.',
      'Refer to the pre-approved list, not a spur-of-the-moment opinion.',
      'If unresolved, offer an equivalent-rank seat and apologise for the confusion.',
      'Record the incident to improve the plan next time.',
    ],
  },
  {
    id: 'wrong-title',
    ar: 'أُعلن اسم أو لقب خاطئ',
    en: 'A wrong name or title was announced',
    stepsAr: [
      'صحّح فوراً وبهدوء من المنصة بصيغة اعتذار قصيرة، دون إطالة.',
      'اعتذر للضيف شخصياً في أول فرصة.',
      'صحّح البطاقة والمواد المطبوعة قبل الفقرة التالية.',
    ],
    stepsEn: [
      'Correct it calmly from the stage with a short apology; do not dwell.',
      'Apologise to the guest personally at the first opportunity.',
      'Fix the card and printed material before the next item.',
    ],
  },
  {
    id: 'prayer-time',
    ar: 'دخول وقت الصلاة أثناء الفعالية',
    en: 'Prayer time falls during the event',
    delay: 15,
    stepsAr: [
      'أعلن استراحة قصيرة في الوقت المناسب وأرشد الحضور إلى مصلّى قريب.',
      'استأنف الجدول بعد العودة لا قبلها، وأزِح الفقرات المتبقية.',
      'يُفضَّل تفادي ذلك في التخطيط بمراجعة مواقيت الصلاة لمدينة الفعالية.',
    ],
    stepsEn: [
      'Announce a short break at a suitable moment and direct guests to a nearby prayer area.',
      'Resume after everyone is back, not before; push the remaining items.',
      'Ideally avoid this at planning time by checking prayer times for the event city.',
    ],
  },
  {
    id: 'medical',
    ar: 'حالة صحية طارئة لأحد الحضور',
    en: 'A guest has a medical emergency',
    stepsAr: [
      'اتصل بالإسعاف (الرقم المحلي) فوراً وحدّد موقع الشخص.',
      'أبعد الحضور بهدوء عن المكان واحفظ الخصوصية والكرامة.',
      'أوقف الفقرة الجارية وأبلغ المضيف، ولا تُصوِّر.',
      'قرّر بعد التقييم هل تستأنف الفعالية أم تؤجَّل.',
    ],
    stepsEn: [
      'Call the local ambulance number immediately and give the exact location.',
      'Calmly move people back and protect privacy and dignity.',
      'Pause the current item, inform the host, and do not photograph.',
      'After assessment decide whether to resume or postpone.',
    ],
    delay: 15,
  },
];
