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

  const sorted = [...competencyBreakdown].sort((a, b) => b.pct - a.pct);
  const strengths = sorted
    .filter((x) => x.pct >= 60)
    .slice(0, 2)
    .map((x) => ({
      competency: x.competency,
      noteAr: `أداء متماسك في هذه الكفاية بنسبة تحقق ${x.pct}% وفق معيار التقييم.`,
      noteEn: `Composed execution in this competency (${x.pct}% rubric attainment).`,
    }));

  const gaps = [...competencyBreakdown]
    .sort((a, b) => a.pct - b.pct)
    .filter((x) => x.pct < 85)
    .slice(0, 2)
    .map((x) => ({
      competency: x.competency,
      noteAr: `فرصة لتعزيز الدقة البروتوكولية في ${x.competency} (${x.pct}%).`,
      noteEn: `Opportunity to sharpen protocol precision in ${x.competency} (${x.pct}%).`,
      exampleAr: 'راجع تفاصيل إشعار المضيف وتوثيق المتغيرات الطارئة خطياً.',
      exampleEn: 'Ensure written escalation of dietary/roster updates and concise host alerts.',
    }));

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
    recommendedNextScenarioId:
      params.scenarioId === 'SCN-DEMO-01' ? 'SCN-DEMO-02' : 'SCN-DEMO-01',
    expertBridgeSuggestion,
    historyPoints: params.previousRunsAvgPcts,
  };
}
