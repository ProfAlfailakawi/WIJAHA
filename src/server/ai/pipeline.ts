import crypto from 'node:crypto';
import { z } from 'zod';
import { ResultBlockSchema } from '../../shared/types.ts';
import { normalizeArabic } from '../../shared/arabic.ts';
import {
  WijahaResultSchema,
  type Assumption,
  type ClarifyingQuestion,
  type ContextChip,
  type ExpertSuggestion,
  type IntentType,
  type Locale,
  type PlanCheckResponse,
  type PlanReviewFinding,
  type ResultBlock,
  type SeatNode,
  type SensitivityLevel,
  type WijahaResult,
} from '../../shared/types.ts';
import type { RetrievedRule } from '../knowledge/retrieval.ts';
import { callGeminiJson, getAiProviderStatus } from './provider.ts';
import { classifyIntent, OUT_OF_SCOPE_RE, stripNegatedMentions, UNSAFE_RE } from './intent-lexicon.ts';

export interface ExtractedEntities {
  intent: IntentType;
  sensitivity: SensitivityLevel;
  countryIso?: string;
  countryLabelAr?: string;
  countryLabelEn?: string;
  guestCount?: number;
  timeHintAr?: string;
  timeHintEn?: string;
  venueType?: 'restaurant' | 'university' | 'corporate' | 'government' | 'personal';
  requestedDraftLang?: string;
  missingCritical?: 'guest_count' | 'country' | 'rank_level';
}

const COUNTRY_PATTERNS: Array<{
  iso: string;
  ar: string;
  en: string;
  tokens: string[];
}> = [
  { iso: 'CN', ar: 'الصين', en: 'China', tokens: ['صين', 'صيني', 'بكين', 'china', 'chinese', 'beijing'] },
  { iso: 'PL', ar: 'بولندا', en: 'Poland', tokens: ['بولندا', 'بولندي', 'بولنديه', 'وارسو', 'poland', 'polish', 'warsaw'] },
  { iso: 'JP', ar: 'اليابان', en: 'Japan', tokens: ['يابان', 'ياباني', 'طوكيو', 'japan', 'japanese', 'tokyo'] },
  { iso: 'GB', ar: 'المملكة المتحدة', en: 'United Kingdom', tokens: ['بريطانيا', 'لندن', 'انجلترا', 'uk', 'london', 'british'] },
  { iso: 'DE', ar: 'ألمانيا', en: 'Germany', tokens: ['المانيا', 'الماني', 'برلين', 'germany', 'german', 'berlin'] },
  { iso: 'FR', ar: 'فرنسا', en: 'France', tokens: ['فرنسا', 'فرنسي', 'باريس', 'france', 'french', 'paris'] },
  { iso: 'US', ar: 'الولايات المتحدة', en: 'United States', tokens: ['امريكا', 'واشنطن', 'usa', 'american', 'washington'] },
  { iso: 'EU', ar: 'أوروبا', en: 'Europe', tokens: ['اوروب', 'europe', 'european'] },
  { iso: 'TR', ar: 'تركيا', en: 'Türkiye', tokens: ['تركيا', 'تركي', 'انقره', 'turkey', 'turkish', 'türkiye'] },
  { iso: 'IN', ar: 'الهند', en: 'India', tokens: ['الهند', 'هندي', 'دلهي', 'india', 'indian', 'delhi'] },
  { iso: 'KR', ar: 'كوريا', en: 'Korea', tokens: ['كوريا', 'كوري', 'سيول', 'korea', 'korean', 'seoul'] },
  { iso: 'BR', ar: 'البرازيل', en: 'Brazil', tokens: ['البرازيل', 'برازيلي', 'brazil', 'brazilian'] },
  { iso: 'IT', ar: 'إيطاليا', en: 'Italy', tokens: ['ايطاليا', 'ايطالي', 'روما', 'italy', 'italian', 'rome'] },
  { iso: 'ES', ar: 'إسبانيا', en: 'Spain', tokens: ['اسبانيا', 'اسباني', 'مدريد', 'spain', 'spanish', 'madrid'] },
  { iso: 'MY', ar: 'ماليزيا', en: 'Malaysia', tokens: ['ماليزيا', 'ماليزي', 'malaysia', 'malaysian'] },
  { iso: 'RU', ar: 'روسيا', en: 'Russia', tokens: ['روسيا', 'روسي', 'موسكو', 'russia', 'russian', 'moscow'] },
  { iso: 'KW', ar: 'الكويت', en: 'Kuwait', tokens: ['كويت', 'الكويت', 'kuwait', 'kuwaiti'] },
  { iso: 'SA', ar: 'السعودية', en: 'Saudi Arabia', tokens: ['سعوديه', 'الرياض', 'saudi', 'riyadh'] },
];

export const ALLOWED_BLOCKS_BY_INTENT: Record<
  IntentType,
  Array<ResultBlock['type']>
> = {
  etiquette_personal: ['answer', 'expert_review'],
  dining_etiquette: ['answer', 'seating', 'expert_review'],
  dress_code: ['answer', 'expert_review'],
  hosting_hospitality: ['checklist', 'seating', 'answer', 'expert_review'],
  delegation_visit_host: ['timeline', 'checklist', 'draft', 'seating', 'expert_review'],
  business_trip_abroad: ['answer', 'checklist', 'expert_review'],
  formal_invitation: ['draft', 'answer', 'expert_review'],
  seating_precedence: ['seating', 'answer', 'expert_review'],
  gift_question: ['answer', 'expert_review'],
  greeting_titles: ['answer', 'draft', 'expert_review'],
  cultural_briefing: ['answer', 'checklist', 'expert_review'],
  plan_review: ['checklist', 'answer', 'expert_review'],
  training_request: ['answer', 'expert_review'],
  expert_request: ['answer', 'expert_review'],
  out_of_scope: ['answer'],
  unsafe: ['answer'],
};

export const DEFAULT_BLOCKS_BY_INTENT: Record<
  IntentType,
  Array<ResultBlock['type']>
> = {
  etiquette_personal: ['answer'],
  dining_etiquette: ['answer'],
  dress_code: ['answer'],
  hosting_hospitality: ['checklist', 'seating'],
  delegation_visit_host: ['timeline', 'checklist', 'draft'],
  business_trip_abroad: ['answer', 'checklist'],
  formal_invitation: ['draft'],
  seating_precedence: ['seating', 'answer'],
  gift_question: ['answer'],
  greeting_titles: ['answer'],
  cultural_briefing: ['answer'],
  plan_review: ['checklist'],
  training_request: ['answer', 'expert_review'],
  expert_request: ['answer', 'expert_review'],
  out_of_scope: ['answer'],
  unsafe: ['answer'],
};

/**
 * Stage 2: Deterministic + fast intent & context analyzer (works identically in mock and evals).
 */
export function analyzeIntentAndContextPure(rawQuery: string): ExtractedEntities {
  const norm = normalizeArabic(rawQuery);
  const lower = rawQuery.toLowerCase();

  // Out of scope check
  if (OUT_OF_SCOPE_RE.test(norm)) {
    return { intent: 'out_of_scope', sensitivity: 'low' };
  }

  if (UNSAFE_RE.test(norm) || UNSAFE_RE.test(lower)) {
    return { intent: 'unsafe', sensitivity: 'low' };
  }

  // Country detection
  let countryIso: string | undefined;
  let countryLabelAr: string | undefined;
  let countryLabelEn: string | undefined;
  for (const c of COUNTRY_PATTERNS) {
    if (c.tokens.some((t) => norm.includes(normalizeArabic(t)) || lower.includes(t))) {
      countryIso = c.iso;
      countryLabelAr = c.ar;
      countryLabelEn = c.en;
      break;
    }
  }

  // Guest count extraction
  const numMatch = rawQuery.match(/\b([2-9]|[1-9][0-9])\b/);
  const guestCount = numMatch ? Number(numMatch[1]) : undefined;

  // High sensitivity check (Section 11.4)
  const highMarkers = [
    'وزير',
    'وزاري',
    'حكومي',
    'سفير',
    'رئيس دوله',
    'معالي',
    'مراسم دوله',
    'minister',
    'ministerial',
    'government',
    'ambassador',
    'head of state',
    'cabinet',
  ];
  const isHigh = highMarkers.some(
    (m) => norm.includes(normalizeArabic(m)) || lower.includes(m),
  );

  // Requested draft language detection
  let requestedDraftLang: string | undefined;
  if (norm.includes('بولنديه') || lower.includes('in polish')) requestedDraftLang = 'pl';
  else if (norm.includes('فرنسيه') || lower.includes('in french')) requestedDraftLang = 'fr';
  else if (norm.includes('صينيه') || lower.includes('in chinese')) requestedDraftLang = 'zh';
  else if (norm.includes('انجليزيه') || lower.includes('in english') || lower.includes('english invitation'))
    requestedDraftLang = 'en';

  const intent: IntentType = classifyIntent(stripNegatedMentions(norm)).intent;

  let sensitivity: SensitivityLevel = 'low';
  if (isHigh) {
    sensitivity = 'high';
  } else if (
    [
      'hosting_hospitality',
      'delegation_visit_host',
      'business_trip_abroad',
      'seating_precedence',
      'gift_question',
      'cultural_briefing',
      'plan_review',
      'expert_request',
    ].includes(intent) ||
    requestedDraftLang === 'pl' ||
    countryIso !== undefined
  ) {
    if (
      intent !== 'dining_etiquette' &&
      intent !== 'dress_code' &&
      intent !== 'etiquette_personal' &&
      !(intent === 'formal_invitation' && !requestedDraftLang && !countryIso)
    ) {
      sensitivity = 'medium';
    }
  }
  if (intent === 'greeting_titles' && !isHigh && !countryIso) {
    sensitivity = 'low';
  }

  let venueType: ExtractedEntities['venueType'] = 'corporate';
  if (intent === 'hosting_hospitality') venueType = 'restaurant';
  else if (norm.includes('جامع') || lower.includes('university') || lower.includes('academic'))
    venueType = 'university';
  else if (isHigh) venueType = 'government';
  else if (intent === 'dining_etiquette' || intent === 'etiquette_personal') venueType = 'personal';

  // Missing critical question (max 1 question, per Appendix A)
  let missingCritical: ExtractedEntities['missingCritical'];
  if (intent === 'hosting_hospitality' && !guestCount) {
    missingCritical = 'guest_count';
  } else if (intent === 'delegation_visit_host' && !countryIso && !isHigh) {
    missingCritical = 'country';
  } else if (intent === 'delegation_visit_host' && isHigh) {
    missingCritical = 'rank_level';
  }

  const isTomorrow =
    norm.includes('بكره') ||
    norm.includes('باجر') ||
    norm.includes('غدا') ||
    lower.includes('tomorrow');

  return {
    intent,
    sensitivity,
    countryIso,
    countryLabelAr,
    countryLabelEn,
    guestCount,
    timeHintAr: isTomorrow ? 'غداً' : undefined,
    timeHintEn: isTomorrow ? 'Tomorrow' : undefined,
    venueType,
    requestedDraftLang,
    missingCritical,
  };
}

function buildSeatingCoordinates(
  layout: 'round' | 'rect' | 'u_shape',
  count: number,
  locale: Locale,
  isBilateral: boolean,
): SeatNode[] {
  const total = Math.max(4, Math.min(14, count));
  const seats: SeatNode[] = [];

  if (layout === 'round') {
    // Host at top center (50, 16) facing entrance at bottom; Chief Guest to host's right (in screen view: 26, 26)
    const labelsAr = [
      { label: 'المضيف الرئيسي', role: 'المضيف (مواجه للمدخل)' },
      { label: 'رئيس الوفد الضيف', role: 'ضيف الشرف الأول (يمين المضيف)' },
      { label: 'نائب المضيف', role: 'الجانب المضيف' },
      { label: 'الضيف الثاني بالوفد', role: 'يسار المضيف' },
      { label: 'مترجم / منسق الوفد', role: 'مساندة تواصل' },
      { label: 'ممثل الجهة المضيفة 2', role: 'الجانب المضيف' },
      { label: 'عضو الوفد الضيف 3', role: 'الوفد الزائر' },
      { label: 'مسؤول المراسم', role: 'إشراف تشغيلي (قرب المدخل)' },
      { label: 'عضو الوفد الضيف 4', role: 'الوفد الزائر' },
      { label: 'ممثل الجهة المضيفة 3', role: 'الجانب المضيف' },
      { label: 'عضو الوفد الضيف 5', role: 'الوفد الزائر' },
      { label: 'ممثل الجهة المضيفة 4', role: 'الجانب المضيف' },
    ];
    const labelsEn = [
      { label: 'Principal Host', role: 'Host (Facing Entrance)' },
      { label: 'Head of Delegation', role: 'Chief Guest (Host Right)' },
      { label: 'Deputy Host', role: 'Host Delegation' },
      { label: 'Second Visiting Principal', role: 'Host Left' },
      { label: 'Interpreter / Liaison', role: 'Communication Support' },
      { label: 'Host Representative 2', role: 'Host Delegation' },
      { label: 'Visiting Delegate 3', role: 'Visiting Delegation' },
      { label: 'Protocol Lead', role: 'Logistics Seat (Near Door)' },
      { label: 'Visiting Delegate 4', role: 'Visiting Delegation' },
      { label: 'Host Representative 3', role: 'Host Delegation' },
      { label: 'Visiting Delegate 5', role: 'Visiting Delegation' },
      { label: 'Host Representative 4', role: 'Host Delegation' },
    ];

    const list = locale === 'ar' ? labelsAr : labelsEn;
    // Evenly spaced angles arranged by diplomatic right-left alternation around top host (-90 deg)
    const step = 360 / total;
    const alternatingOffsets: number[] = [0];
    for (let k = 1; alternatingOffsets.length < total; k++) {
      alternatingOffsets.push(-k * step);
      if (alternatingOffsets.length < total) {
        alternatingOffsets.push(k * step);
      }
    }
    for (let i = 0; i < total; i++) {
      const deg = -90 + (alternatingOffsets[i] ?? 0);
      const rad = (deg * Math.PI) / 180;
      const x = Math.round(50 + 35 * Math.cos(rad));
      const y = Math.round(50 + 35 * Math.sin(rad));
      const meta = list[i] ?? {
        label: locale === 'ar' ? `مقعد ${i + 1}` : `Seat ${i + 1}`,
        role: locale === 'ar' ? 'مشارك' : 'Participant',
      };
      seats.push({
        id: `seat_${i + 1}`,
        label: meta.label,
        role: meta.role,
        rank: i + 1,
        x,
        y,
      });
    }
    return seats;
  }

  // Rectangular bilateral table (top row = Host side, bottom row = Visiting side facing across)
  const perSide = Math.max(3, Math.ceil(total / 2));
  for (let i = 0; i < perSide; i++) {
    const x = Math.round(20 + (i * 60) / Math.max(1, perSide - 1));
    const isCenter = i === Math.floor(perSide / 2);
    seats.push({
      id: `host_${i + 1}`,
      label: isCenter
        ? locale === 'ar'
          ? 'رئيس الوفد المضيف'
          : 'Host Principal'
        : locale === 'ar'
          ? `ممثل المضيف ${i + 1}`
          : `Host Member ${i + 1}`,
      role: isBilateral
        ? locale === 'ar'
          ? 'الجانب المضيف'
          : 'Host Side'
        : undefined,
      rank: isCenter ? 1 : i + 3,
      x,
      y: 26,
    });
    seats.push({
      id: `guest_${i + 1}`,
      label: isCenter
        ? locale === 'ar'
          ? 'رئيس الوفد الضيف'
          : 'Visiting Head'
        : i === Math.floor(perSide / 2) + 1
          ? locale === 'ar'
            ? 'المترجم المرافق'
            : 'Interpreter'
          : locale === 'ar'
            ? `عضو الوفد الضيف ${i + 1}`
            : `Visiting Member ${i + 1}`,
      role: locale === 'ar' ? 'الوفد الضيف' : 'Visiting Side',
      rank: isCenter ? 2 : i + 4,
      x,
      y: 74,
    });
  }
  return seats.slice(0, total);
}

/**
 * Deterministic Stage 6 Guardrail & Verification Function (100% pure & unit-tested).
 * Guarantees zero hallucinated ruleIds, enforces intent block rules, and enforces high-sensitivity expert_review.
 */
export function verifyAndHardenResultPure(
  draftResult: WijahaResult,
  retrievedRules: RetrievedRule[],
  expertSuggestionsEnabled = true,
): WijahaResult {
  const validRuleMap = new Map(retrievedRules.map((r) => [r.id, r]));
  const usedRuleIds = new Set<string>();
  let unreviewedClaims = 0;

  // 1. Filter blocks to allowed types for intent (or fallback to default)
  const allowedTypes = ALLOWED_BLOCKS_BY_INTENT[draftResult.intent] ?? ['answer'];
  let blocks = draftResult.blocks.filter((b) => allowedTypes.includes(b.type));
  if (blocks.length === 0) {
    blocks = [
      {
        type: 'answer',
        points: [
          {
            text:
              draftResult.locale === 'ar'
                ? 'يُنصح بمراجعة تفاصيل المناسبة مع مسؤول المراسم المختص لضمان الدقة.'
                : 'Review occasion specifics with your protocol lead prior to confirmation.',
            level: 'advisory',
          },
        ],
      },
    ];
  }

  // 2. Strip any non-existent ruleId and mark ungrounded claims as advisory
  blocks = blocks.map((block): ResultBlock => {
    if (block.type === 'answer') {
      return {
        ...block,
        points: block.points.slice(0, 7).map((pt) => {
          if (pt.ruleId && validRuleMap.has(pt.ruleId)) {
            usedRuleIds.add(pt.ruleId);
            const r = validRuleMap.get(pt.ruleId)!;
            return { ...pt, level: r.level };
          }
          unreviewedClaims += 1;
          return { text: pt.text, level: 'advisory' };
        }),
      };
    }
    if (block.type === 'checklist') {
      return {
        ...block,
        groups: block.groups.map((g) => ({
          ...g,
          items: g.items.map((it, idx) => {
            if (it.ruleId && validRuleMap.has(it.ruleId)) {
              usedRuleIds.add(it.ruleId);
              return { ...it, id: it.id || `chk_${idx}` };
            }
            unreviewedClaims += 1;
            return { ...it, id: it.id || `chk_${idx}`, ruleId: undefined };
          }),
        })),
      };
    }
    if (block.type === 'timeline') {
      return {
        ...block,
        days: block.days.map((d) => ({
          ...d,
          items: d.items.map((it) => {
            if (it.ruleId && validRuleMap.has(it.ruleId)) {
              usedRuleIds.add(it.ruleId);
              return it;
            }
            unreviewedClaims += 1;
            return { ...it, ruleId: undefined };
          }),
        })),
      };
    }
    if (block.type === 'draft') {
      const isThirdLang = !['ar', 'en'].includes(block.language.toLowerCase());
      const mustReview =
        block.reviewRequired || isThirdLang || draftResult.trust.sensitivity === 'high';
      return {
        ...block,
        reviewRequired: mustReview,
      };
    }
    if (block.type === 'seating') {
      return {
        ...block,
        officialPrecedenceNotice: true,
        principles: block.principles.map((p) => {
          if (p.ruleId && validRuleMap.has(p.ruleId)) {
            usedRuleIds.add(p.ruleId);
            return p;
          }
          unreviewedClaims += 1;
          return { text: p.text };
        }),
      };
    }
    return block;
  });

  // 3. Enforce high-sensitivity expert_review block (Section 11.2 Stage 6 & Section 13.2: 100%)
  const isHigh = draftResult.trust.sensitivity === 'high';
  const hasExpertBlock = blocks.some((b) => b.type === 'expert_review');

  if (isHigh && !hasExpertBlock) {
    const expertBlock: ResultBlock = {
      type: 'expert_review',
      reason:
        draftResult.locale === 'ar'
          ? 'لأن هذه المناسبة ذات حساسية رسمية رفيعة (حكومية/وزارية أو تتضمن ترتيب أسبقية رسمي)، ننصح بمراجعة خبير مراسم قبل الاعتماد النهائي.'
          : 'Because this occasion involves high-level official or ministerial protocol, specialist review is recommended prior to final sign-off.',
      expertSlug: 'yousef-al-hasani',
      serviceId: 'SRV-YOUSEF-REVIEW',
      recommendedExpertName:
        draftResult.locale === 'ar' ? 'د. يوسف الحسني' : 'Dr. Yousef Al-Hasani',
      serviceTitle:
        draftResult.locale === 'ar'
          ? 'مراجعة خبير لخطة زيارة وفد أو مأدبة رسمية'
          : 'Specialist Protocol Audit of Visit Plan & Seating',
    };
    if (blocks.length >= 3) {
      blocks = [blocks[0], blocks[1], expertBlock];
    } else {
      blocks = [...blocks, expertBlock];
    }
  }

  // Enforce max 3 blocks
  blocks = blocks.slice(0, 3);

  // 4. Compute accurate trust metadata
  const verifiedIds = Array.from(usedRuleIds);
  let reviewedCount = 0;
  let demoCount = 0;
  const sourcesDetail = verifiedIds.map((id) => {
    const r = validRuleMap.get(id)!;
    if (r.status === 'approved') reviewedCount += 1;
    else demoCount += 1;
    return {
      ruleId: r.id,
      ruleTitle: draftResult.locale === 'ar' ? r.titleAr : r.titleEn,
      level: r.level,
      status: r.status,
      reviewedBy: r.reviewedBy ?? undefined,
    };
  });

  // 5. Deterministic Expert Bridge suggestion (Section 15.2)
  let expertSuggestion: ExpertSuggestion | undefined = draftResult.expertSuggestion;
  if (!expertSuggestionsEnabled) {
    expertSuggestion = undefined;
  } else if (isHigh) {
    expertSuggestion = {
      trigger: 'high_sensitivity',
      serviceId: 'SRV-YOUSEF-REVIEW',
      expertSlug: 'yousef-al-hasani',
      expertName: draftResult.locale === 'ar' ? 'د. يوسف الحسني' : 'Dr. Yousef Al-Hasani',
      serviceTitle:
        draftResult.locale === 'ar'
          ? 'مراجعة خبير لخطة زيارة وفد أو مأدبة رسمية'
          : 'Specialist Protocol Audit of Visit Plan & Seating',
      reason:
        draftResult.locale === 'ar'
          ? 'لأن هذه المناسبة رسمية رفيعة وتتطلب توافقاً مع المراسم الرسمية، ننصح بمراجعة الخطة من مختص قبل اعتمادها.'
          : 'Given the official rank and precedence sensitivity of this occasion, we recommend a specialist audit prior to approval.',
      priceLabel: draftResult.locale === 'ar' ? '95 د.ك · خلال 3 أيام عمل' : '95 KWD · 3 business days',
    };
  } else if (draftResult.intent === 'training_request') {
    expertSuggestion = {
      trigger: 'explicit_request',
      serviceId: 'SRV-JOINT-ACADEMY',
      expertSlug: 'ahmad-al-failakawi',
      expertName:
        draftResult.locale === 'ar'
          ? 'د. يوسف الحسني ود. أحمد الفيلكاوي'
          : 'Dr. Yousef Al-Hasani & Dr. Ahmad Al-Failakawi',
      serviceTitle:
        draftResult.locale === 'ar'
          ? 'برنامج تأهيل فرق المراسم بالمحاكاة التطبيقية (مشترك)'
          : 'Joint Protocol & Smart Simulation Readiness Program',
      reason:
        draftResult.locale === 'ar'
          ? 'بناءً على طلبكم لبرنامج تدريبي للفريق، يمكنكم طلب عرض فني ومالي مخصص لاحتياج جهتكم.'
          : 'Based on your team training inquiry, you can request a tailored cohort proposal.',
      priceLabel: draftResult.locale === 'ar' ? 'عرض سعر مخصص' : 'Custom Proposal',
    };
  } else if (draftResult.intent === 'expert_request' || (draftResult.trust.sensitivity === 'medium' && unreviewedClaims >= 3)) {
    expertSuggestion = {
      trigger: draftResult.intent === 'expert_request' ? 'explicit_request' : 'unreviewed_claims',
      serviceId: 'SRV-YOUSEF-REVIEW',
      expertSlug: 'yousef-al-hasani',
      expertName: draftResult.locale === 'ar' ? 'د. يوسف الحسني' : 'Dr. Yousef Al-Hasani',
      serviceTitle:
        draftResult.locale === 'ar'
          ? 'مراجعة خبير لخطة زيارة وفد أو مأدبة رسمية'
          : 'Specialist Protocol Audit of Visit Plan & Seating',
      reason:
        draftResult.locale === 'ar'
          ? 'لتدقيق التفاصيل التنفيذية وأسبقية الجلوس والمراسلات قبل موعد المناسبة.'
          : 'For human verification of your itinerary, seating order, and correspondence prior to the event.',
      priceLabel: draftResult.locale === 'ar' ? '95 د.ك' : '95 KWD',
    };
  }

  const candidate: WijahaResult = {
    ...draftResult,
    summary: draftResult.summary.slice(0, 3),
    blocks,
    secondaryActions: draftResult.secondaryActions.slice(0, 3),
    trust: {
      ruleIds: verifiedIds,
      reviewedCount,
      demoCount,
      unreviewedClaims,
      lastReviewedAt: reviewedCount > 0 ? '2026-11' : undefined,
      sensitivity: draftResult.trust.sensitivity,
      sourcesDetail,
    },
    expertSuggestion,
  };

  const parsed = WijahaResultSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  // Safe fallback if schema ever fails
  return WijahaResultSchema.parse({
    id: draftResult.id,
    locale: draftResult.locale,
    title: draftResult.title.slice(0, 60),
    intent: draftResult.intent,
    context: draftResult.context,
    assumptions: draftResult.assumptions,
    summary: [
      draftResult.locale === 'ar'
        ? 'تم إعداد إرشادات أولية آمنة للمراجعة.'
        : 'Prepared safe initial guidance for your review.',
    ],
    blocks: [
      {
        type: 'answer',
        points: [
          {
            text:
              draftResult.locale === 'ar'
                ? 'يرجى مراجعة التفاصيل الأساسية للمناسبة قبل الاعتماد.'
                : 'Please review the core occasion parameters prior to confirmation.',
            level: 'advisory',
          },
        ],
      },
    ],
    primaryAction: draftResult.primaryAction,
    secondaryActions: [],
    trust: {
      ruleIds: [],
      reviewedCount: 0,
      demoCount: 0,
      unreviewedClaims: 1,
      sensitivity: draftResult.trust.sensitivity,
    },
  });
}

/**
 * Generates a rich, domain-grounded WijahaResult from retrieved rules (and optional Gemini enrichment).
 */
const GeminiCandidateSchema = z.object({
  title: z.string().max(200).optional(),
  summary: z.array(z.string().max(400)).max(5).optional(),
  blocks: z.array(ResultBlockSchema).min(1).max(4),
});

export async function executeWijahaPipeline(params: {
  rawQuery: string;
  locale: Locale;
  retrievedRules: RetrievedRule[];
  entities: ExtractedEntities;
  clarificationAnswer?: string;
  overrideContext?: Record<string, string>;
  expertSuggestionsEnabled?: boolean;
  onStage?: (stage: 'understanding' | 'retrieving' | 'generating') => void;
}): Promise<WijahaResult> {
  const { locale, retrievedRules, entities } = params;
  const resultId = `res_${crypto.randomUUID()}`;

  // Out-of-scope polite response
  if (entities.intent === 'out_of_scope' || entities.intent === 'unsafe') {
    const polite: WijahaResult = {
      id: resultId,
      locale,
      title:
        locale === 'ar'
          ? 'تخصص وجاهة في البروتوكول والمراسم'
          : 'WIJAHA Specializes in Protocol & Hospitality',
      intent: entities.intent,
      isOutOfScope: true,
      context: [],
      assumptions: [],
      summary: [
        locale === 'ar'
          ? 'تختص منصة وجاهة بالبروتوكول والمراسم، وتنظيم زيارات الوفود، وآداب الضيافة والأعمال، والمراسلات الرسمية.'
          : 'WIJAHA focuses exclusively on diplomatic & corporate protocol, delegation visits, formal dining etiquette, and official correspondence.',
      ],
      blocks: [
        {
          type: 'answer',
          points: [
            {
              text:
                locale === 'ar'
                  ? 'يمكنك تجربة سؤال مثل: «عندنا وفد أكاديمي لتوقيع مذكرة تفاهم» أو «عندي عشاء رسمي، كيف أتصرف؟».'
                  : 'Try describing an occasion such as: "Hosting a visiting academic delegation for an MoU signing" or "Preparing for a formal corporate dinner."',
              level: 'advisory',
            },
          ],
        },
      ],
      primaryAction: {
        id: 'practice',
        label: locale === 'ar' ? 'استكشف سيناريوهات المحاكاة' : 'Explore Protocol Simulations',
        targetUrl: '/practice',
      },
      secondaryActions: [],
      trust: {
        ruleIds: [],
        reviewedCount: 0,
        demoCount: 0,
        unreviewedClaims: 0,
        sensitivity: 'low',
      },
    };
    return polite;
  }

  // Context Chips
  const context: ContextChip[] = [];
  const effectiveGuests =
    params.overrideContext?.guests
      ? Number(params.overrideContext.guests) || 8
      : params.clarificationAnswer && /\d+/.test(params.clarificationAnswer)
        ? Number(params.clarificationAnswer.match(/\d+/)?.[0]) || 8
        : entities.guestCount ?? 8;

  const countryDisplay =
    params.overrideContext?.country ||
    (params.clarificationAnswer && !/\d+/.test(params.clarificationAnswer)
      ? params.clarificationAnswer
      : locale === 'ar'
        ? entities.countryLabelAr
        : entities.countryLabelEn);

  if (countryDisplay) {
    context.push({ key: 'country', label: countryDisplay, editable: true });
  }
  if (
    ['hosting_hospitality', 'delegation_visit_host', 'seating_precedence'].includes(
      entities.intent,
    )
  ) {
    context.push({
      key: 'guests',
      label: locale === 'ar' ? `${effectiveGuests} مشاركين` : `${effectiveGuests} participants`,
      editable: true,
    });
  }
  if (entities.timeHintAr || entities.timeHintEn) {
    context.push({
      key: 'timing',
      label: (locale === 'ar' ? entities.timeHintAr : entities.timeHintEn) || '',
      editable: true,
    });
  }
  context.push({
    key: 'context_type',
    label:
      entities.sensitivity === 'high'
        ? locale === 'ar'
          ? 'مناسبة رسمية رفيعة'
          : 'High-Level Official'
        : entities.venueType === 'restaurant'
          ? locale === 'ar'
            ? 'ضيافة مطعم VIP'
            : 'VIP Restaurant Hospitality'
          : entities.venueType === 'university'
            ? locale === 'ar'
              ? 'سياق أكاديمي جامعي'
              : 'University / Academic'
            : locale === 'ar'
              ? 'سياق أعمال رسمي'
              : 'Formal Business',
    editable: true,
  });

  // Single Clarifying Question (if missingCritical and not yet answered)
  let clarification: ClarifyingQuestion | undefined;
  if (!params.clarificationAnswer && entities.missingCritical === 'guest_count') {
    clarification = {
      id: 'clarify_guests',
      field: 'guests',
      question: locale === 'ar' ? 'كم عدد أفراد الوفد تقريباً؟' : 'Approximately how many guests are in the delegation?',
      options:
        locale === 'ar'
          ? ['4 أشخاص', '8 أشخاص', '12 شخصاً أو أكثر']
          : ['4 guests', '8 guests', '12+ guests'],
    };
  } else if (!params.clarificationAnswer && entities.missingCritical === 'country') {
    clarification = {
      id: 'clarify_country',
      field: 'country',
      question: locale === 'ar' ? 'من أي دولة أو منطقة الوفد الضيف؟' : 'Which country or region is the visiting delegation from?',
      options:
        locale === 'ar'
          ? ['أوروبا (مثلاً بولندا)', 'شرق آسيا (الصين/اليابان)', 'دول الخليج العربي']
          : ['Europe (e.g. Poland)', 'East Asia (China/Japan)', 'GCC / Arab States'],
    };
  } else if (!params.clarificationAnswer && entities.missingCritical === 'rank_level') {
    clarification = {
      id: 'clarify_rank',
      field: 'rank',
      question: locale === 'ar' ? 'ما المستوى البروتوكولي لرئيس الوفد؟' : 'What is the protocol rank of the head of delegation?',
      options:
        locale === 'ar'
          ? ['وزير أو من في حكمه', 'وكيل وزارة / سفير', 'وفد فني أو إداري']
          : ['Cabinet Minister', 'Undersecretary / Ambassador', 'Technical / Executive Delegation'],
    };
  }

  // Assumptions
  const assumptions: Assumption[] = [];
  if (entities.sensitivity !== 'high') {
    assumptions.push({
      id: 'assump_formality',
      text:
        locale === 'ar'
          ? 'افترضنا أن المناسبة ذات طابع مؤسسي رسمي وليست حكومية سيادية'
          : 'Assumed an institutional/corporate formal occasion rather than sovereign state protocol',
      alternativeText:
        locale === 'ar'
          ? 'تغيير السياق إلى مناسبة حكومية رسمية رفيعة المستوى'
          : 'Switch to sovereign / ministerial high-sensitivity protocol',
      editable: true,
    });
  }

  // Try optional live Gemini generation if configured; otherwise build rich deterministic blocks from retrievedRules
  const providerStatus = getAiProviderStatus();
  if (providerStatus.mode !== 'mock') {
    try {
      const geminiCandidate = await callGeminiJson<Partial<WijahaResult>>({
        locale,
        systemInstruction:
          'You are WIJAHA protocol engine. Output strictly valid JSON matching WijahaResult summary and blocks using ONLY the provided retrieved ruleIds.',
        userPrompt: JSON.stringify({
          query: params.rawQuery,
          locale,
          intent: entities.intent,
          rules: retrievedRules.map((r) => ({
            id: r.id,
            title: locale === 'ar' ? r.titleAr : r.titleEn,
            body: locale === 'ar' ? r.bodyAr : r.bodyEn,
            level: r.level,
          })),
        }),
      });
      // E3: model output is untrusted. Validate every block against the strict schema; drop anything invalid.
      const candidateParse = GeminiCandidateSchema.safeParse(geminiCandidate);
      if (!candidateParse.success) {
        console.warn('Gemini output failed schema validation; using deterministic builder.');
      }
      const validBlocks = candidateParse.success ? candidateParse.data.blocks : [];
      if (candidateParse.success && validBlocks.length > 0) {
        const merged: WijahaResult = {
          id: resultId,
          locale,
          title: (candidateParse.data.title || params.rawQuery).slice(0, 60),
          intent: entities.intent,
          context,
          assumptions,
          clarification,
          summary: (candidateParse.data.summary || []).slice(0, 3),
          blocks: validBlocks,
          primaryAction: {
            id: 'export_pdf',
            label: locale === 'ar' ? 'حمّل الخطة للفريق' : 'Download Plan (PDF)',
          },
          secondaryActions: [
            { id: 'save_project', label: locale === 'ar' ? 'احفظ كمشروع' : 'Save as Project' },
            { id: 'practice', label: locale === 'ar' ? 'تدرّب على هذا الموقف' : 'Practice Scenario', targetUrl: '/practice' },
          ],
          trust: {
            ruleIds: [],
            reviewedCount: 0,
            demoCount: 0,
            unreviewedClaims: 0,
            sensitivity: entities.sensitivity,
          },
        };
        return verifyAndHardenResultPure(merged, retrievedRules, params.expertSuggestionsEnabled);
      }
    } catch (err) {
      console.warn('Live Gemini call fell back to deterministic builder:', err);
    }
  }

  // Deterministic high-craft synthesis from retrieved rules
  const desiredBlockTypes = DEFAULT_BLOCKS_BY_INTENT[entities.intent] ?? ['answer'];
  const r = (idx: number) => retrievedRules[idx] ?? retrievedRules[0];

  const titleMapAr: Record<IntentType, string> = {
    etiquette_personal: 'دليل التصرف الشخصي في المناسبات الرسمية',
    dining_etiquette: 'آداب المائدة والعشاء الرسمي',
    dress_code: 'دليل اللباس الرسمي والمظهر البروتوكولي',
    hosting_hospitality: `خطة ضيافة واستقبال وفد ${countryDisplay || 'كبار الضيوف'}`,
    delegation_visit_host: `برنامج استقبال الوفد ${countryDisplay ? `(${countryDisplay})` : 'وتوقيع الاتفاقية'}`,
    business_trip_abroad: `خطة الاستعداد لزيارة العمل ${countryDisplay ? `في ${countryDisplay}` : 'الخارجية'}`,
    formal_invitation: 'مسودة الدعوة الرسمية المعتمدة للمراجعة',
    seating_precedence: 'مخطط ترتيب الجلوس والأسبقية المقترح',
    gift_question: 'ضوابط ومقترحات الهدايا الرسمية',
    greeting_titles: 'دليل المخاطبة الرسمية والألقاب',
    cultural_briefing: `إيجاز التواصل الثقافي المهني ${countryDisplay ? `— ${countryDisplay}` : ''}`,
    plan_review: 'قائمة فحص جاهزية البرنامج والهوامش الزمنية',
    training_request: 'توصيات تأهيل وتدريب فريق المراسم',
    expert_request: 'إعداد ملف المراجعة مع خبير المراسم',
    out_of_scope: 'نطاق خدمات وجاهة',
    unsafe: 'نطاق خدمات وجاهة',
  };

  const titleMapEn: Record<IntentType, string> = {
    etiquette_personal: 'Personal Conduct Guide for Formal Occasions',
    dining_etiquette: 'Formal Dining & Table Etiquette Brief',
    dress_code: 'Formal Attire & Ceremonial Dress Guide',
    hosting_hospitality: `VIP Hospitality & Table Plan${countryDisplay ? ` (${countryDisplay})` : ''}`,
    delegation_visit_host: `Delegation Visit & Signing Program${countryDisplay ? ` — ${countryDisplay}` : ''}`,
    business_trip_abroad: `Outbound Business Visit Briefing${countryDisplay ? ` — ${countryDisplay}` : ''}`,
    formal_invitation: 'Formal Invitation Correspondence Draft',
    seating_precedence: '2D Seating & Order of Precedence Plan',
    gift_question: 'Official Gift Etiquette & Compliance Guide',
    greeting_titles: 'Official Addressing & Honorifics Guide',
    cultural_briefing: `Cross-Cultural Executive Briefing${countryDisplay ? ` — ${countryDisplay}` : ''}`,
    plan_review: 'Itinerary Buffer & Readiness Audit Checklist',
    training_request: 'Protocol Team Training & Simulation Path',
    expert_request: 'Specialist Protocol Review Preparation',
    out_of_scope: 'WIJAHA Scope',
    unsafe: 'WIJAHA Scope',
  };

  const summaryPoints = retrievedRules.slice(0, 3).map((rule) =>
    locale === 'ar' ? rule.bodyAr : rule.bodyEn,
  );
  if (summaryPoints.length === 0) {
    summaryPoints.push(
      locale === 'ar'
        ? 'تأكد من تحديد مستوى التمثيل والقيود الغذائية وترتيب الجلوس قبل الموعد بوقت كافٍ.'
        : 'Confirm counterpart seniority, dietary requirements, and seating order well ahead of arrival.',
    );
  }

  const blocks: ResultBlock[] = [];

  for (const bType of desiredBlockTypes) {
    if (bType === 'answer') {
      const pts = retrievedRules.slice(0, 5).map((rule) => ({
        text: locale === 'ar' ? rule.bodyAr : rule.bodyEn,
        ruleId: rule.id,
        level: rule.level,
      }));
      blocks.push({
        type: 'answer',
        points:
          pts.length > 0
            ? pts
            : [
                {
                  text:
                    locale === 'ar'
                      ? 'يُراعى التنسيق المسبق مع الجهة المضيفة للتحقق من تفاصيل البروتوكول المعتمدة.'
                      : 'Coordinate ahead of time with the host liaison to verify event-specific protocol.',
                  level: 'advisory',
                },
              ],
      });
    } else if (bType === 'checklist') {
      const ruleA = r(0);
      const ruleB = r(1);
      const ruleC = r(2);
      const ruleD = r(3);
      blocks.push({
        type: 'checklist',
        groups: [
          {
            title: locale === 'ar' ? 'قبل الوصول بـ 24–48 ساعة' : '24–48 Hours Prior to Arrival',
            items: [
              {
                id: 'chk_1',
                text:
                  locale === 'ar'
                    ? ruleA?.bodyAr || 'التحقق من قائمة الأسماء والألقاب والقيود الغذائية والحساسيات.'
                    : ruleA?.bodyEn || 'Verify exact delegate roster, titles, and dietary allergens.',
                when: locale === 'ar' ? 'قبل 24 ساعة' : 'T-24h',
                owner: locale === 'ar' ? 'منسق المراسم' : 'Protocol Lead',
                critical: true,
                ruleId: ruleA?.id,
              },
              {
                id: 'chk_2',
                text:
                  locale === 'ar'
                    ? ruleB?.bodyAr || 'اعتماد مخطط الجلوس وطباعة بطاقات الأسماء من الوجهين.'
                    : ruleB?.bodyEn || 'Finalize seating chart and print double-sided tent nameplates.',
                when: locale === 'ar' ? 'قبل 24 ساعة' : 'T-24h',
                owner: locale === 'ar' ? 'فريق التنظيم' : 'Events Team',
                critical: true,
                ruleId: ruleB?.id,
              },
            ],
          },
          {
            title: locale === 'ar' ? 'يوم المناسبة والاستقبال' : 'Day of Occasion & Arrival',
            items: [
              {
                id: 'chk_3',
                text:
                  locale === 'ar'
                    ? ruleC?.bodyAr || 'تواجد مسؤول الاستقبال عند البوابة قبل 15 دقيقة ومرافقة الوفد لصالة الضيافة.'
                    : ruleC?.bodyEn || 'Station curbside greeter 15 minutes early and escort to VIP lounge.',
                when: locale === 'ar' ? 'قبل 15 دقيقة' : 'T-15m',
                owner: locale === 'ar' ? 'مسؤول الاستقبال' : 'Reception Liaison',
                critical: true,
                ruleId: ruleC?.id,
              },
              {
                id: 'chk_4',
                text:
                  locale === 'ar'
                    ? ruleD?.bodyAr || 'إيجاز فريق الضيافة وترتيب التسوية المالية أو تبادل الهدايا بعيداً عن الحرج.'
                    : ruleD?.bodyEn || 'Brief hospitality staff on serving order and discreet off-table settlement.',
                when: locale === 'ar' ? 'قبل البدء' : 'Pre-session',
                owner: locale === 'ar' ? 'مشرف الضيافة' : 'Hospitality Lead',
                critical: false,
                ruleId: ruleD?.id,
              },
            ],
          },
        ],
      });
    } else if (bType === 'timeline') {
      const rPause = retrievedRules.find((x) => x.id === 'R-DEMO-0019') ?? r(0);
      const rSign = retrievedRules.find((x) => x.id === 'R-DEMO-0020') ?? r(1);
      const rBuf = retrievedRules.find((x) => x.id === 'R-DEMO-0047') ?? r(2);
      blocks.push({
        type: 'timeline',
        days: [
          {
            label:
              locale === 'ar'
                ? 'اليوم الأول — البرنامج الرسمي للزيارة'
                : 'Day 1 — Official Delegation Program',
            items: [
              {
                time: '09:45',
                title:
                  locale === 'ar'
                    ? 'الاستقبال عند المدخل الرئيسي ومرافقة الوفد'
                    : 'Curbside Arrival & Welcome Escort',
                detail:
                  locale === 'ar'
                    ? 'ترحيب رسمي واستراحة قصيرة لمدة 15 دقيقة في صالة كبار الزوار قبل بدء المباحثات.'
                    : 'Formal welcome followed by a 15-minute courtesy pause in the executive lounge.',
                location: locale === 'ar' ? 'بهو كبار الزوار' : 'VIP Reception Lounge',
                ruleId: rPause?.id,
              },
              {
                time: '10:00',
                title:
                  locale === 'ar'
                    ? 'جلسة المباحثات الثنائية والكلمات الترحيبية'
                    : 'Bilateral Meeting & Opening Remarks',
                detail:
                  locale === 'ar'
                    ? 'جلوس الوفدين متقابلين وفق مطابقة المستوى الوظيفي واستعراض بنود التعاون.'
                    : 'Across-table counterpart alignment and review of joint cooperation pillars.',
                location: locale === 'ar' ? 'قاعة الاجتماعات الرئيسية' : 'Main Boardroom',
                ruleId: rBuf?.id,
              },
              {
                time: '11:00',
                title:
                  locale === 'ar'
                    ? 'مراسم توقيع مذكرة التفاهم والتصوير الرسمي'
                    : 'MoU Signing Ceremony & Official Photograph',
                detail:
                  locale === 'ar'
                    ? 'توقيع النسختين الأصليتين وتبادل الملفات والمصافحة وتقديم التذكار المؤسسي.'
                    : 'Counter-signing bound originals, folder exchange, handshake, and institutional gift.',
                location: locale === 'ar' ? 'قاعة التوقيع' : 'Signing Salon',
                ruleId: rSign?.id,
              },
            ],
          },
        ],
      });
    } else if (bType === 'draft') {
      const draftLang =
        entities.requestedDraftLang ||
        (entities.intent === 'delegation_visit_host' ? 'en' : locale);
      const rInv = retrievedRules.find((x) => x.id === 'R-DEMO-0033') ?? r(0);

      let draftText = '';
      if (draftLang === 'pl') {
        draftText =
          'Szanowny Panie Rektorze / Magnificencjo,\n\nZ wyrazami najwyższego szacunku mamy zaszczyt zaprosić Pana Rektora wraz z Delegacją Uczelni na uroczystość podpisania Memorandum o Porozumieniu.\n\nData: [Data] · Godzina: 10:00\nMiejsce: Sala Posiedzeń Rektoratu, Kuwejt\nStrój: Formalny biznesowy (Business Formal)\nRSVP: protocol@institution.example\n\nZ poważaniem,\n[Imię i Stanowisko Gospodarza]';
      } else if (draftLang === 'en') {
        draftText =
          'Subject: Formal Invitation — Delegation Visit & Memorandum of Understanding Signing Ceremony\n\nDear [Title & Full Name],\n\nOn behalf of [Host Institution], I have the honor to extend a cordial invitation to you and your esteemed delegation to attend our bilateral meeting and official MoU signing ceremony.\n\nDate: [Day, Date]\nTime: 10:00 AM – 12:30 PM (followed by an official luncheon)\nVenue: Main Executive Hall, [Host Address, Kuwait]\nDress Code: Business Formal / National Attire\nRSVP: Kindly confirm delegation roster and dietary preferences by [RSVP Date] via [Contact Email].\n\nYours sincerely,\n[Host Name & Official Title]';
      } else {
        draftText =
          'الموضوع: دعوة رسمية لحضور مراسم الاستقبال وتوقيع الاتفاقية\n\nسعادة / [اللقب والاسم الكامل المحترم]،\nتحية طيبة وبعد،\n\nيتشرف [اسم الجهة المضيفة] بدعوة سعادتكم والوفد المرافق لحضور جلسة المباحثات المشتركة وحفل التوقيع الرسمي.\n\nالتاريخ: [اليوم والتاريخ]\nالوقت: الساعة 10:00 صباحاً حتى 12:30 ظهراً\nالمكان: القاعة الرئيسية — [عنوان المقر والمدخل المخصص]\nاللباس: رسمي (الزي الوطني أو بدلة عمل داكنة)\nتأكيد الحضور (RSVP): يرجى التفضل بتأكيد قائمة الوفد والمتطلبات الخاصة قبل [التاريخ] عبر [البريد/الهاتف].\n\nوتفضلوا بقبول فائق الاحترام والتقدير،،،\n[اسم المضيف ومنصبه الرسمي]';
      }

      blocks.push({
        type: 'draft',
        kind: 'invitation',
        language: draftLang,
        text: draftText,
        reviewRequired: draftLang !== 'ar' && draftLang !== 'en',
        notes: [
          locale === 'ar'
            ? `استندت الهيكلة إلى العناصر السبعة للدعوة الرسمية (${rInv?.id || 'مسودة تجريبية'}).`
            : `Structured around the seven formal invitation elements (${rInv?.id || 'demo rule'}).`,
          locale === 'ar'
            ? 'يرجى التحقق الحرفي من تهجئة الأسماء والألقاب من القائمة الرسمية للضيف قبل الإرسال.'
            : 'Verify verbatim guest name spelling and academic/diplomatic titles before dispatch.',
        ],
      });
    } else if (bType === 'seating') {
      const qNorm = normalizeArabic(params.rawQuery);
      const qLower = params.rawQuery.toLowerCase();
      const mentionsRound =
        qNorm.includes('مستدير') ||
        qNorm.includes('دائري') ||
        qNorm.includes('عشاء') ||
        qLower.includes('round') ||
        qLower.includes('dinner') ||
        qLower.includes('banquet');
      const useRound =
        mentionsRound || entities.intent === 'hosting_hospitality' || entities.countryIso === 'CN';
      const layout = useRound ? 'round' : 'rect';
      const seats = buildSeatingCoordinates(
        layout,
        effectiveGuests,
        locale,
        !useRound,
      );
      const rSeat1 =
        retrievedRules.find((x) => x.id === 'R-DEMO-0011' || x.id === 'R-DEMO-0038') ?? r(0);
      const rSeat2 =
        retrievedRules.find((x) => x.id === 'R-DEMO-0040' || x.id === 'R-DEMO-0039') ?? r(1);

      blocks.push({
        type: 'seating',
        layout,
        seats,
        host: locale === 'ar' ? 'المضيف الرئيسي' : 'Principal Host',
        officialPrecedenceNotice: true,
        principles: [
          {
            text:
              locale === 'ar'
                ? rSeat1?.bodyAr || 'يجلس ضيف الشرف الأول عن يمين المضيف مباشرة.'
                : rSeat1?.bodyEn || 'Seat the chief guest immediately to the host’s right.',
            ruleId: rSeat1?.id,
          },
          {
            text:
              locale === 'ar'
                ? rSeat2?.bodyAr || 'يوضع مقعد المترجم بجوار رئيس الوفد لتيسير الحوار بسلاسة.'
                : rSeat2?.bodyEn || 'Position the interpreter adjacent to the head of delegation.',
            ruleId: rSeat2?.id,
          },
        ],
      });
    }
  }

  const primaryActionLabel =
    entities.intent === 'etiquette_personal' || entities.intent === 'dining_etiquette'
      ? locale === 'ar'
        ? 'تدرّب على هذا الموقف (3 دقائق)'
        : 'Practice in 3-Minute Simulation'
      : locale === 'ar'
        ? 'حمّل الخطة للفريق (PDF)'
        : 'Download Team Plan (PDF)';

  const primaryActionId =
    entities.intent === 'etiquette_personal' || entities.intent === 'dining_etiquette'
      ? 'practice'
      : 'export_pdf';

  const rawResult: WijahaResult = {
    id: resultId,
    locale,
    title: (locale === 'ar' ? titleMapAr[entities.intent] : titleMapEn[entities.intent]).slice(
      0,
      75,
    ),
    intent: entities.intent,
    context,
    assumptions,
    clarification,
    summary: summaryPoints,
    blocks,
    primaryAction: {
      id: primaryActionId,
      label: primaryActionLabel,
      targetUrl: primaryActionId === 'practice' ? '/practice/SCN-DEMO-01' : undefined,
    },
    secondaryActions: [
      { id: 'save_project', label: locale === 'ar' ? 'احفظ كمشروع' : 'Save as Project' },
      { id: 'export_docx', label: locale === 'ar' ? 'تصدير Word' : 'Export DOCX' },
      {
        id: 'practice',
        label: locale === 'ar' ? 'محاكاة تطبيقية' : 'Practice Scenario',
        targetUrl: '/practice',
      },
    ],
    trust: {
      ruleIds: [],
      reviewedCount: 0,
      demoCount: 0,
      unreviewedClaims: 0,
      sensitivity: entities.sensitivity,
    },
  };

  return verifyAndHardenResultPure(
    rawResult,
    retrievedRules,
    params.expertSuggestionsEnabled ?? true,
  );
}

/**
 * Natural-language "Update Plan" (Section 8.4) producing an updated WijahaResult + clear diff summary!
 */
export function applyNaturalProjectUpdatePure(
  current: WijahaResult,
  instruction: string,
  locale: Locale,
): { updated: WijahaResult; diffSummary: string[] } {
  const cloned: WijahaResult = JSON.parse(JSON.stringify(current));
  const diffSummary: string[] = [];
  const norm = normalizeArabic(instruction);

  // Detect guest count change
  const numMatch = instruction.match(/\b([2-9]|[1-9][0-9])\b/);
  if (numMatch) {
    const newCount = Number(numMatch[1]);
    const guestChip = cloned.context.find((c) => c.key === 'guests');
    const newLabel = locale === 'ar' ? `${newCount} مشاركين` : `${newCount} participants`;
    if (guestChip) {
      diffSummary.push(
        locale === 'ar'
          ? `تحديث حجم الوفد من «${guestChip.label}» إلى «${newLabel}».`
          : `Updated delegation size from "${guestChip.label}" to "${newLabel}".`,
      );
      guestChip.label = newLabel;
    } else {
      cloned.context.push({ key: 'guests', label: newLabel, editable: true });
      diffSummary.push(
        locale === 'ar'
          ? `إضافة حجم الوفد الجديد: ${newLabel}.`
          : `Added updated delegation count: ${newLabel}.`,
      );
    }

    // Recompute seating block if present, or add seating notes
    cloned.blocks = cloned.blocks.map((b) => {
      if (b.type === 'seating') {
        diffSummary.push(
          locale === 'ar'
            ? `إعادة توزيع مخطط الجلوس ليشمل ${Math.min(14, newCount)} مقعداً بالتناوب البروتوكولي.`
            : `Rebalanced 2D seating floorplan to accommodate ${Math.min(14, newCount)} seats.`,
        );
        return {
          ...b,
          seats: buildSeatingCoordinates(
            b.layout === 'round' ? 'round' : 'rect',
            newCount,
            locale,
            b.layout !== 'round',
          ),
        };
      }
      if (b.type === 'checklist') {
        const updatedGroups = [...b.groups];
        updatedGroups[0] = {
          ...updatedGroups[0],
          items: [
            ...updatedGroups[0].items,
            {
              id: `chk_upd_${Date.now()}`,
              text:
                locale === 'ar'
                  ? `تأكيد سعة القاعة وبطاقات الأسماء الإضافية للعدد المحدث (${newCount} مشاركاً).`
                  : `Confirm room capacity and print extra tent cards for updated count (${newCount}).`,
              when: locale === 'ar' ? 'فوراً' : 'Immediate',
              critical: true,
            },
          ],
        };
        diffSummary.push(
          locale === 'ar'
            ? 'إضافة بند تحقق من سعة القاعة وبطاقات الأسماء للعدد الجديد في قائمة التجهيز.'
            : 'Added capacity and nameplate verification item to readiness checklist.',
        );
        return { ...b, groups: updatedGroups };
      }
      return b;
    });
  }

  // Detect postponement / schedule shift
  if (
    norm.includes('تاجل') ||
    norm.includes('تأجل') ||
    norm.includes('يوم') ||
    instruction.toLowerCase().includes('postpone') ||
    instruction.toLowerCase().includes('moved') ||
    instruction.toLowerCase().includes('day')
  ) {
    cloned.blocks = cloned.blocks.map((b) => {
      if (b.type === 'timeline') {
        diffSummary.push(
          locale === 'ar'
            ? 'ترحيل عنوان الجدول الزمني وإضافة إشعار إعادة تأكيد الحجوزات والمرافقين بعد تعديل الموعد.'
            : 'Shifted itinerary day header and added reconfirmation notice for updated date.',
        );
        return {
          ...b,
          days: b.days.map((d) => ({
            ...d,
            label:
              locale === 'ar'
                ? `${d.label} (موعد محدّث — بعد التأجيل)`
                : `${d.label} (Rescheduled Date)`,
          })),
        };
      }
      if (b.type === 'draft') {
        diffSummary.push(
          locale === 'ar'
            ? 'إضافة تنبيه تحديث الموعد في ملاحظات مسودة الدعوة.'
            : 'Added date-change notification note to correspondence draft.',
        );
        return {
          ...b,
          notes: [
            ...b.notes,
            locale === 'ar'
              ? 'ملاحظة تحديث: يُرجى إرسال إشعار بتعديل الموعد للمدعوين المؤكدين.'
              : 'Update note: Dispatch revised date notice to confirmed attendees.',
          ],
        };
      }
      return b;
    });
  }

  if (diffSummary.length === 0) {
    diffSummary.push(
      locale === 'ar'
        ? `تم استيعاب الملاحظة الجديدة في ملخص الخطة: «${instruction.slice(0, 80)}».`
        : `Incorporated update instruction into plan summary: "${instruction.slice(0, 80)}".`,
    );
    cloned.summary = [
      locale === 'ar'
        ? `تحديث مستجد: ${instruction.slice(0, 120)}`
        : `Plan update: ${instruction.slice(0, 120)}`,
      ...cloned.summary.slice(0, 2),
    ];
  }

  return { updated: cloned, diffSummary };
}

/**
 * "Check My Plan" (/check) Pure Risk Auditor (Section 8.7)
 */
export function auditVisitPlanPure(
  planText: string,
  contextNote: string | undefined,
  locale: Locale,
): PlanCheckResponse {
  const norm = normalizeArabic(`${planText} ${contextNote || ''}`);
  const lower = `${planText} ${contextNote || ''}`.toLowerCase();
  const findings: PlanReviewFinding[] = [];

  // 1. Check missing arrival buffer / immediate transition
  if (
    !norm.includes('استراحه') &&
    !norm.includes('هامش') &&
    !lower.includes('buffer') &&
    !lower.includes('lounge') &&
    !lower.includes('pause')
  ) {
    findings.push({
      id: 'f_buffer',
      severity: 'critical',
      what:
        locale === 'ar'
          ? 'غياب فترة استراحة قصيرة أو هامش زمني احتياطي عند وصول الوفد'
          : 'No courtesy arrival pause or transition buffer between segments',
      why:
        locale === 'ar'
          ? 'أي تأخر مروري بسيط لمركبة الوفد سيربك موعد التوقيع الرسمي، كما أن إدخال الضيوف مباشرة دون استراحة يضعف سلاسة الاستقبال.'
          : 'Any minor traffic delay will cascade into formal ceremony times, and ushering delegates straight from transit to signing feels rushed.',
      suggestion:
        locale === 'ar'
          ? 'أضف فقرة استراحة ترحيبية (10–15 دقيقة) في صالة كبار الزوار قبل بدء الاجتماع أو التوقيع الرسمي.'
          : 'Insert a 10–15 minute courtesy lounge pause upon arrival before formal talks or signing.',
      ruleId: 'R-DEMO-0019',
      ruleTitle:
        locale === 'ar'
          ? '[تجريبي] فترة استراحة قصيرة للوفد بعد الوصول قبل الاجتماع الرسمي'
          : '[Demo] Courtesy Refreshment Pause Before Formal Talks',
    });
  }

  // 2. Check gift risk in front of press or ministerial official
  if (
    norm.includes('هديه') ||
    norm.includes('وزير') ||
    lower.includes('gift') ||
    lower.includes('minister')
  ) {
    findings.push({
      id: 'f_gift',
      severity: 'critical',
      what:
        locale === 'ar'
          ? 'تقديم هدية لمسؤول رسمي دون تنسيق مسبق مع المراسم أو أمام وسائل الإعلام'
          : 'Unvetted gift presentation to a public official or in front of press',
      why:
        locale === 'ar'
          ? 'تخضع هدايا الوزراء والمسؤولين لسقوف امتثال وإفصاح قانوني صارم، وقد يضطر الضيف للاعتذار عن قبولها علناً إن لم تُنسق مسبقاً.'
          : 'Ministerial gifts face strict statutory disclosure limits; uncoordinated public presentation risks awkward refusal on camera.',
      suggestion:
        locale === 'ar'
          ? 'نسّق نوع التذكار الرمزي وقيمته مسبقاً بين مسؤولي المراسم في الجانبين، واجعل التبادل مؤسسياً متماثلاً.'
          : 'Clear institutional mementos in advance coordinator-to-coordinator to ensure compliance and reciprocity.',
      ruleId: 'R-DEMO-0043',
      ruleTitle:
        locale === 'ar'
          ? '[تجريبي] قيود الهدايا للمسؤولين الحكوميين والوزراء الأجانب'
          : '[Demo] Statutory Gift Limits & Disclosure Rules for Government Officials',
    });
  }

  // 3. Check dietary & seating verification
  if (
    !norm.includes('حساسيه') &&
    !norm.includes('غذائيه') &&
    !lower.includes('dietary') &&
    !lower.includes('allergen')
  ) {
    findings.push({
      id: 'f_dietary',
      severity: 'important',
      what:
        locale === 'ar'
          ? 'لم يُذكر التحقق المسبق من المتطلبات والحساسيات الغذائية للوفد'
          : 'Dietary restrictions and allergen confirmation not explicitly noted',
      why:
        locale === 'ar'
          ? 'مفاجآت الحساسية الغذائية أو القيود الثقافية أثناء الضيافة أو الغداء تسبب حرجاً مباشراً.'
          : 'Uncaught allergens or cultural dietary restrictions during hospitality service create preventable risk.',
      suggestion:
        locale === 'ar'
          ? 'أضف بند تأكيد المتطلبات الغذائية مع منسق الوفد قبل 24 ساعة وبطاقات تعريف للأطباق.'
          : 'Confirm dietary requirements with the delegation liaison 24h prior and label dishes clearly.',
      ruleId: 'R-DEMO-0012',
      ruleTitle:
        locale === 'ar'
          ? '[تجريبي] التحقق المسبق من القيود الغذائية والحساسية للوفود'
          : '[Demo] Advance Dietary & Allergen Confirmation',
    });
  }

  // 4. Improvement suggestion: Nameplates & Liaison contact
  findings.push({
    id: 'f_liaison',
    severity: 'improvement',
    what:
      locale === 'ar'
        ? 'تثبيت اسم ورقم ضابط الاتصال المرافق وتحديد نقاط التصوير المسموحة'
        : 'Specify dedicated curbside greeter contact and approved photo moments',
    why:
      locale === 'ar'
        ? 'توضيح نقطة النزول واسم المستقبل ولحظات التصوير المعتمدة يرفع راحة الضيف وانضباط التغطية.'
        : 'Naming the curbside liaison and pre-clearing photo moments streamlines arrival and media etiquette.',
    suggestion:
      locale === 'ar'
        ? 'أرفق في ذيل البرنامج اسم ورقم منسق الاستقبال المتواجد قبل 15 دقيقة من الوصول.'
        : 'Append the name and mobile number of the greeter stationed 15 minutes ahead at the gate.',
    ruleId: 'R-DEMO-0015',
    ruleTitle:
      locale === 'ar'
        ? '[تجريبي] تخصيص مسؤول استقبال عند المدخل الخارجي للوفد VIP'
        : '[Demo] Curbside Greeting Liaison for VIP Arrivals',
  });

  return {
    id: `chk_${crypto.randomUUID()}`,
    locale,
    summary:
      locale === 'ar'
        ? `تم فحص مسودة خطتك دون تعديل نصك الأصلي: رصدنا ${findings.length} ملاحظات بروتوكولية مرتبة حسب الأولوية.`
        : `Audited your draft itinerary without modifying your original text: identified ${findings.length} prioritized protocol findings.`,
    findings,
    isDemoContent: true,
  };
}
