import { normalizeArabic } from '../../shared/arabic.ts';
import type {
  CompetencyCode,
  ExpertSuggestion,
  Locale,
  ScenarioNode,
  ScenarioRubric,
  SimulationReport,
} from '../../shared/types.ts';

export function evaluateFreeTextStepPure(
  answerText: string,
  criterionId: string | undefined,
  rubric: ScenarioRubric,
  locale: Locale,
): {
  scores: Record<string, number>;
  feedbackAr: string;
  feedbackEn: string;
  ruleIds: string[];
} {
  const criterion =
    rubric.criteria.find((c) => c.id === criterionId) ?? rubric.criteria[0];
  if (!criterion) {
    return {
      scores: { C6: 2 },
      feedbackAr: 'تم تسجيل إجابتك وتقييمها وفق وضوح الإيجاز التنفيذي.',
      feedbackEn: 'Your briefing note was recorded and evaluated for clarity.',
      ruleIds: ['R-DEMO-0048'],
    };
  }

  const norm = normalizeArabic(answerText);
  const lower = answerText.toLowerCase();
  const matchedKeywords = [
    ...criterion.keywordsAr.filter((k) => norm.includes(normalizeArabic(k))),
    ...criterion.keywordsEn.filter((k) => lower.includes(k.toLowerCase())),
  ];

  const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length;
  let score: 0 | 1 | 2 | 3 = 1;
  if (wordCount >= 10 && matchedKeywords.length >= 3) {
    score = 3;
  } else if (wordCount >= 6 && matchedKeywords.length >= 1) {
    score = 2;
  } else if (wordCount < 3) {
    score = 0;
  }

  const levelDesc =
    criterion.levels.find((l) => l.score === score) ??
    criterion.levels[criterion.levels.length - 1];

  const feedbackAr =
    score === 3
      ? `إيجاز متقن (${levelDesc?.descriptorAr || 'مستوى متقدم'}): ذكرت مكان استضافة الوفد والجاهزية والتفاصيل بهدوء.`
      : `تقييم المعيار (${score}/3 — ${levelDesc?.descriptorAr || ''}): للوصول للدرجة الكاملة، حدد بوضوح مكان استضافة الوفد في صالة الاستراحة، وجاهزية القاعة لموعد 10:00، وتفاصيل العضو البديل.`;

  const feedbackEn =
    score === 3
      ? `Exemplary executive briefing (${levelDesc?.descriptorEn || 'Full marks'}): clearly noted lounge hosting, 10:00 readiness, and the delegate substitution.`
      : `Rubric score (${score}/3 — ${levelDesc?.descriptorEn || ''}): To reach full marks, explicitly state lounge hosting, 10:00 room readiness, and the substitute delegate details.`;

  // unused locale guard
  void locale;

  return {
    scores: { [criterion.competency]: score },
    feedbackAr,
    feedbackEn,
    ruleIds: ['R-DEMO-0048', 'R-DEMO-0019'],
  };
}

const COMPETENCY_NAMES: Record<CompetencyCode, { ar: string; en: string }> = {
  C1: { ar: 'الاستقبال والتوديع', en: 'Reception & farewell' },
  C2: { ar: 'الأسبقية والجلوس', en: 'Precedence & seating' },
  C3: { ar: 'الضيافة وآداب المائدة', en: 'Hospitality & dining' },
  C4: { ar: 'التواصل بين الثقافات', en: 'Cross-cultural communication' },
  C5: { ar: 'المراسلات الرسمية', en: 'Official correspondence' },
  C6: { ar: 'المواقف الطارئة', en: 'Handling the unexpected' },
  C7: { ar: 'التخطيط والتنسيق', en: 'Planning & coordination' },
};

const SCENARIO_ORDER = ['SCN-DEMO-01', 'SCN-DEMO-02', 'SCN-ARAB-01', 'SCN-ARAB-02', 'SCN-ARAB-03', 'SCN-ARAB-04'];

/** Recommends the next scenario in the catalogue order, wrapping around. */
export function nextScenarioId(current: string): string {
  const idx = SCENARIO_ORDER.indexOf(current);
  return SCENARIO_ORDER[(idx + 1) % SCENARIO_ORDER.length];
}

export function buildSimulationReportPure(params: {
  runId: string;
  scenarioId: string;
  scenarioTitleAr: string;
  scenarioTitleEn: string;
  competencies: string[];
  nodes: ScenarioNode[];
  steps: Array<{
    nodeId: string;
    scores: Record<string, number>;
    feedbackAr: string;
    feedbackEn: string;
    ruleIds: string[];
  }>;
  previousRunsAvgPcts?: Array<{ runIndex: number; avgPct: number; at: string }>;
  repeatedLowCompetency?: CompetencyCode | null;
  locale: Locale;
}): SimulationReport {
  const totals = new Map<CompetencyCode, { earned: number; max: number }>();

  for (const c of params.competencies) {
    totals.set(c as CompetencyCode, { earned: 0, max: 0 });
  }

  for (const step of params.steps) {
    for (const [comp, sc] of Object.entries(step.scores)) {
      const code = comp as CompetencyCode;
      const cur = totals.get(code) ?? { earned: 0, max: 0 };
      cur.earned += sc;
      cur.max += 3;
      totals.set(code, cur);
    }
  }

  const competencyBreakdown = Array.from(totals.entries()).map(([comp, val]) => {
    const maxScore = Math.max(3, val.max);
    const pct = Math.round((val.earned / maxScore) * 100);
    return {
      competency: comp,
      score: val.earned,
      maxScore,
      pct,
    };
  });

  // D2: every strength/gap names its competency and cites what actually happened in this session.
  const bestStepFor = (comp: CompetencyCode) =>
    [...params.steps]
      .filter((st) => st.scores[comp] !== undefined)
      .sort((a, b) => (b.scores[comp] ?? 0) - (a.scores[comp] ?? 0))[0];
  const worstStepFor = (comp: CompetencyCode) =>
    [...params.steps]
      .filter((st) => st.scores[comp] !== undefined)
      .sort((a, b) => (a.scores[comp] ?? 0) - (b.scores[comp] ?? 0))[0];

  const sorted = [...competencyBreakdown].sort((a, b) => b.pct - a.pct);
  const strengths = sorted
    .filter((x) => x.pct >= 60)
    .slice(0, 2)
    .map((x) => {
      const names = COMPETENCY_NAMES[x.competency];
      const step = bestStepFor(x.competency);
      return {
        competency: x.competency,
        noteAr: `${names.ar}: ${x.pct}% من معيار التقييم.${step ? ` ${step.feedbackAr}` : ''}`,
        noteEn: `${names.en}: ${x.pct}% of the rubric.${step ? ` ${step.feedbackEn}` : ''}`,
        ruleIds: step?.ruleIds ?? [],
      };
    });

  const gaps = [...competencyBreakdown]
    .sort((a, b) => a.pct - b.pct)
    .filter((x) => x.pct < 85)
    .slice(0, 2)
    .map((x) => {
      const names = COMPETENCY_NAMES[x.competency];
      const step = worstStepFor(x.competency);
      return {
        competency: x.competency,
        noteAr: `${names.ar}: ${x.pct}% من معيار التقييم.`,
        noteEn: `${names.en}: ${x.pct}% of the rubric.`,
        exampleAr: step?.feedbackAr ?? '',
        exampleEn: step?.feedbackEn ?? '',
        ruleIds: step?.ruleIds ?? [],
      };
    });

  let expertBridgeSuggestion: ExpertSuggestion | undefined;
  if (params.repeatedLowCompetency) {
    expertBridgeSuggestion = {
      trigger: 'competency_gap',
      serviceId: 'SRV-YOUSEF-WORKSHOP',
      expertSlug: 'yousef-al-hasani',
      expertName: params.locale === 'ar' ? 'د. يوسف الحسني' : 'Dr. Yousef Al-Hasani',
      serviceTitle:
        params.locale === 'ar'
          ? 'ورشة تطبيقية: بروتوكول استقبال الوفود والأسبقية'
          : 'Executive Workshop: Delegation Hosting & Precedence',
      reason:
        params.locale === 'ar'
          ? `ظهرت فجوة متكررة في كفاية ${params.repeatedLowCompetency} عبر جلستين؛ قد يفيدك تدريب تطبيقي متخصص.`
          : `A recurring gap in ${params.repeatedLowCompetency} appeared across multiple sessions; a targeted workshop can reinforce mastery.`,
      priceLabel: params.locale === 'ar' ? 'اطلب عرض سعر' : 'Request Quote',
    };
  }

  return {
    runId: params.runId,
    scenarioId: params.scenarioId,
    scenarioTitleAr: params.scenarioTitleAr,
    scenarioTitleEn: params.scenarioTitleEn,
    completedAt: new Date().toISOString(),
    competencyBreakdown,
    strengths,
    gaps,
    explanations: params.steps.map((s) => ({
      stepNodeId: s.nodeId,
      feedbackAr: s.feedbackAr,
      feedbackEn: s.feedbackEn,
      ruleIds: s.ruleIds,
    })),
    recommendedNextScenarioId: nextScenarioId(params.scenarioId),
    expertBridgeSuggestion,
    historyPoints: params.previousRunsAvgPcts,
  };
}
