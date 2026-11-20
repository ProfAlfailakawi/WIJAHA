/**
 * Voice simulation scripts. The "guest" is a scripted persona and the answers are scored with a transparent keyword
 * rubric (no AI cost, fully offline). The rubric rewards courtesy, ownership and a concrete solution, and penalises
 * blame or dismissal. It is a practice aid, not an assessment of real protocol competence.
 */
import { normalizeArabic } from '../arabic.ts';

export interface Check {
  id: string;
  anyOf: string[];
  weight: number;
  labelAr: string;
  labelEn: string;
  tipAr: string;
  tipEn: string;
}
export interface Forbidden {
  anyOf: string[];
  penalty: number;
  tipAr: string;
  tipEn: string;
}
export interface Turn {
  guestAr: string;
  guestEn: string;
  checks: Check[];
  forbidden: Forbidden[];
  reaction: { good: [string, string]; ok: [string, string]; bad: [string, string] };
}
export interface Persona {
  id: string;
  nameAr: string;
  nameEn: string;
  blurbAr: string;
  blurbEn: string;
  voice: 'ar-SA' | 'en-GB';
  turns: Turn[];
}

const APOLOGY: Check = {
  id: 'apology', weight: 3, anyOf: ['اعتذر', 'نعتذر', 'عذرا', 'آسف', 'اسف', 'المعذرة', 'تأسف', 'sorry', 'apolog'],
  labelAr: 'اعتذار صادق', labelEn: 'A sincere apology',
  tipAr: 'ابدأ بالاعتذار المختصر قبل الشرح.', tipEn: 'Open with a short apology before explaining.',
};
const SOLUTION: Check = {
  id: 'solution', weight: 4, anyOf: ['سوف', 'ساقوم', 'سارتب', 'ساوفر', 'ساتواصل', 'نرتب', 'نوفر', 'اقترح', 'تفضل', 'حالا', 'فورا', 'الان', 'will', 'arrange', 'right away', 'immediately', 'let me'],
  labelAr: 'حل عملي فوري', labelEn: 'A concrete immediate solution',
  tipAr: 'قدّم خطوة محددة الآن (سأرتب، نوفر، تفضّل…).', tipEn: 'Offer a specific step now (I will arrange…, please come…).',
};
const RESPECT_AR: Check = {
  id: 'respect', weight: 3, anyOf: ['طال عمرك', 'يا سيدي', 'سعادتك', 'معاليك', 'سموك', 'شيخنا', 'يا شيخ', 'حضرتك', 'excellency', 'dear sir', 'your highness', 'your excellency'],
  labelAr: 'مخاطبة بلقب مناسب', labelEn: 'Proper form of address',
  tipAr: 'خاطبه بلقبه (سعادتك، معاليك، طال عمرك…).', tipEn: 'Address them by title (Your Excellency, sir…).',
};
const BLAME: Forbidden = {
  anyOf: ['مو ذنبي', 'مش ذنبي', 'مو مسؤوليتي', 'غيري', 'القسم الثاني', 'not my fault', 'not my job', 'someone else'],
  penalty: 40,
  tipAr: 'لا تُلقِ اللوم على غيرك أمام الضيف.', tipEn: 'Never shift blame to others in front of a guest.',
};
const REFUSE: Forbidden = {
  anyOf: ['مستحيل', 'ما نقدر', 'ما اقدر', 'لا يمكن', 'مو ممكن', 'impossible', 'cannot', "can't", 'no way'],
  penalty: 35,
  tipAr: 'تجنّب الرفض المباشر؛ اعرض بديلاً.', tipEn: 'Avoid a flat refusal; offer an alternative.',
};

export const PERSONAS: Persona[] = [
  {
    id: 'sheikh',
    nameAr: 'شيخ وجيه', nameEn: 'A respected sheikh',
    blurbAr: 'يصل متأخراً ويجد مقعده في الصف الثاني.', blurbEn: 'Arrives late and finds his seat in the second row.',
    voice: 'ar-SA',
    turns: [
      {
        guestAr: 'السلام عليكم. وصلت ولقيت اسمي في الصف الثاني، شلون هذا؟',
        guestEn: 'Peace be upon you. I arrived and found my name in the second row. How come?',
        checks: [APOLOGY, RESPECT_AR, SOLUTION],
        forbidden: [BLAME, REFUSE],
        reaction: {
          good: ['الله يعطيك العافية، هذا المطلوب.', 'Thank you, that is what I expected.'],
          ok: ['طيب، شوف لي حل.', 'Well, find me a solution.'],
          bad: ['ما توقعت هالمعاملة.', 'I did not expect this treatment.'],
        },
      },
      {
        guestAr: 'والمرافقين حقي وين يجلسون؟',
        guestEn: 'And where will my companions sit?',
        checks: [{ ...SOLUTION, anyOf: [...SOLUTION.anyOf, 'بجانبك', 'خلفك', 'قريب', 'next to', 'behind'] }, RESPECT_AR],
        forbidden: [REFUSE],
        reaction: {
          good: ['ممتاز، جزاك الله خير.', 'Excellent, thank you.'],
          ok: ['إن شاء الله يكون ترتيب طيب.', 'I hope the arrangement is good.'],
          bad: ['هذا غير مقبول.', 'This is unacceptable.'],
        },
      },
    ],
  },
  {
    id: 'ambassador',
    nameAr: 'سفير أجنبي', nameEn: 'A foreign ambassador',
    blurbAr: 'يلاحظ أن علم بلاده في موضع غير لائق.', blurbEn: 'Notices his country’s flag is badly placed.',
    voice: 'en-GB',
    turns: [
      {
        guestAr: 'عذراً، علم بلدي موضوع في الطرف. هل هناك سبب لذلك؟',
        guestEn: 'Excuse me, my country’s flag is at the far edge. Is there a reason?',
        checks: [APOLOGY, RESPECT_AR, SOLUTION],
        forbidden: [BLAME, REFUSE],
        reaction: {
          good: ['Thank you for fixing it so promptly.', 'شكراً لمعالجتك السريعة.'],
          ok: ['I see. Please make sure it is corrected.', 'حسناً، تأكد من تصحيحه.'],
          bad: ['I will have to report this to my embassy.', 'سأضطر لإبلاغ سفارتي.'],
        },
      },
      {
        guestAr: 'وهل ترتيب الأعلام حسب الأبجدية أم حسب الرتبة؟',
        guestEn: 'Is the flag order alphabetical or by rank?',
        checks: [
          { id: 'explain', weight: 4, anyOf: ['ابجد', 'ترتيب', 'متبع', 'alphabet', 'order', 'agreed', 'protocol'], labelAr: 'شرح معيار الترتيب بوضوح', labelEn: 'Explains the ordering criterion', tipAr: 'اذكر المعيار المتبع (أبجدي أو حسب الاتفاق).', tipEn: 'State the criterion used (alphabetical or agreed).' },
          RESPECT_AR,
        ],
        forbidden: [BLAME],
        reaction: {
          good: ['Clear, thank you.', 'واضح، شكراً.'],
          ok: ['Understood.', 'مفهوم.'],
          bad: ['That is not an answer.', 'هذا ليس جواباً.'],
        },
      },
    ],
  },
  {
    id: 'angry',
    nameAr: 'ضيف غاضب', nameEn: 'An angry guest',
    blurbAr: 'جلس بعيداً عن المنصة ويرى أنه أُهين.', blurbEn: 'Seated far from the stage and feels insulted.',
    voice: 'ar-SA',
    turns: [
      {
        guestAr: 'أنا جالس في آخر القاعة! هذا استهتار بي!',
        guestEn: 'I am sitting at the back of the hall! This is disrespect!',
        checks: [APOLOGY, SOLUTION, { id: 'calm', weight: 2, anyOf: ['اهدأ', 'تفهم', 'اقدر', 'اتفهم', 'غضبك', 'understand', 'i hear you'], labelAr: 'إظهار التفهّم', labelEn: 'Showing understanding', tipAr: 'قل ما يفيد أنك تتفهم انزعاجه.', tipEn: 'Say something showing you understand his upset.' }],
        forbidden: [BLAME, REFUSE],
        reaction: {
          good: ['طيب، شكراً على تفهمك.', 'Fine, thank you for understanding.'],
          ok: ['خلنا نشوف الحل.', 'Let us see the solution.'],
          bad: ['أنا طالع!', 'I am leaving!'],
        },
      },
    ],
  },
];

function norm(s: string): string {
  return normalizeArabic(s).toLowerCase();
}

export interface TurnScore {
  score: number;
  tier: 'good' | 'ok' | 'bad';
  hits: string[];
  misses: Check[];
  penalties: Forbidden[];
}

export function scoreAnswer(turn: Turn, answer: string): TurnScore {
  const text = norm(answer);
  const hit = (list: string[]) => list.some((k) => text.includes(norm(k)));
  const total = turn.checks.reduce((a, c) => a + c.weight, 0);
  let got = 0;
  const hits: string[] = [];
  const misses: Check[] = [];
  for (const c of turn.checks) {
    if (hit(c.anyOf)) {
      got += c.weight;
      hits.push(c.id);
    } else misses.push(c);
  }
  const penalties = turn.forbidden.filter((f) => hit(f.anyOf));
  let score = Math.round((got / Math.max(1, total)) * 100) - penalties.reduce((a, p) => a + p.penalty, 0);
  if (text.trim().length < 12) score = Math.min(score, 30);
  score = Math.max(0, Math.min(100, score));
  return { score, tier: score >= 70 ? 'good' : score >= 40 ? 'ok' : 'bad', hits, misses, penalties };
}
