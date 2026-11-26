import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Play,
  TrendingUp,
} from 'lucide-react';
import { BRAND } from '../config/brand';
import { AppShell } from '../components/layout/AppShell';
import { ExpertBridgeCard } from '../components/result-blocks/ResultBlocks';
import { PostureViewer } from '../components/three/PostureViewer';
import { CounterpartStage } from '../components/three/CounterpartStage';
import { reactionFor } from '../shared/tools/counterpart.ts';
import { PassportSeals } from '../components/visuals/PassportSeals';
import { POSE_INFO } from '../shared/tools/poses.ts';
import {
  Button,
  DemoContentNotice,
  ErrorBanner,
  ResilientImage,
  Skeleton,
} from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n } from '../lib/i18n';
import type { CompetencyCode, ScenarioNode, SimulationReport } from '../shared/types';

interface ScenarioSummary {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  level: number;
  estimatedMinutes: number;
  competencies: CompetencyCode[];
  nodes: ScenarioNode[];
  status: string;
}

// ---------------------------------------------------------------------------
// 1. Scenarios Directory (/practice)
// ---------------------------------------------------------------------------

export function PracticeListPage() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scenarios')
      .then((r) => r.json())
      .then((d: { scenarios: ScenarioSummary[] }) => setScenarios(d.scenarios || []))
      .finally(() => setLoading(false));
  }, []);

  const levelLabel = (lvl: number) =>
    lvl === 1 ? t.practice.level1 : lvl === 2 ? t.practice.level2 : t.practice.level3;

  return (
    <AppShell>
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Quiet Editorial Header */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center space-y-3">
            <DemoContentNotice text={t.practice.demoTag} compact />
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">{t.practice.title}</h1>
            <p className="text-sm sm:text-base text-[var(--ink-2)] leading-relaxed">
              {t.practice.subtitle}
            </p>
          </div>
          <figure className="md:col-span-5 min-h-[190px] flex flex-col">
            <ResilientImage
              src={BRAND.assets.protocolSalon}
              alt={
                locale === 'ar'
                  ? 'مشهد تمثيلي توضيحي لاستقبال بروتوكولي'
                  : 'Illustrative editorial protocol reception scene'
              }
              className="w-full flex-1 max-h-[220px]"
            />
            <figcaption className="px-3 py-1.5 text-[11px] text-[var(--ink-3)] border-t border-[var(--line)]">
              {locale === 'ar'
                ? 'مشهد تمثيلي توضيحي للمحاكاة التطبيقية'
                : 'Illustrative editorial simulation scene'}
            </figcaption>
          </figure>
        </section>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {scenarios.map((sc) => (
              <article
                key={sc.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--gold-ink)] font-medium tabular-nums">
                    <span>{levelLabel(sc.level)}</span>
                    <span className="inline-flex items-center gap-1 text-[var(--ink-3)]">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {sc.estimatedMinutes} {t.practice.minutes}
                      </span>
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-[var(--ink)]">
                    {locale === 'ar' ? sc.titleAr : sc.titleEn}
                  </h2>

                  <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                    {locale === 'ar' ? sc.descriptionAr : sc.descriptionEn}
                  </p>

                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {sc.competencies.map((comp) => (
                      <span
                        key={comp}
                        className="text-[11px] px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-2)]"
                      >
                        {t.practice.competencies[comp]}
                      </span>
                    ))}
                  </div>
                </div>

                <Button
                  variant="primary"
                  onClick={() => navigate(`/practice/${sc.id}`)}
                  className="w-full"
                >
                  <Play className="w-4 h-4" />
                  <span>{t.practice.startBtn}</span>
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 2. Interactive Simulation Runner (/practice/:scenarioId)
// ---------------------------------------------------------------------------

export function SimulationRunnerPage() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const { locale, t } = useI18n();
  const { getBearerHeaders } = useAuth();
  const navigate = useNavigate();

  const [runId, setRunId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioSummary | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string>('');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [freeText, setFreeText] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [stepOutcome, setStepOutcome] = useState<{
    feedback: string;
    ruleIds: string[];
    finished: boolean;
    nextNodeId?: string;
  } | null>(null);

  useEffect(() => {
    if (!scenarioId) return;
    setErrorMsg(null);
    fetch('/api/simulations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
      body: JSON.stringify({ scenarioId, locale }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        const data = (await res.json()) as {
          runId: string;
          scenario: ScenarioSummary;
          currentNodeId: string;
        };
        setRunId(data.runId);
        setScenario(data.scenario);
        setCurrentNodeId(data.currentNodeId);
      })
      .catch(() => setErrorMsg(t.home.networkError));
  }, [scenarioId, locale, getBearerHeaders, t.home.networkError]);

  const playableNodes = useMemo(
    () => (scenario?.nodes || []).filter((n) => !n.isEnd),
    [scenario],
  );
  const currentNode = useMemo(
    () => playableNodes.find((n) => n.id === currentNodeId) ?? null,
    [playableNodes, currentNodeId],
  );
  const currentIndex = playableNodes.findIndex((n) => n.id === currentNodeId);
  // The counterpart's posture follows the chosen option's own rubric scores (display only).
  const reaction = !stepOutcome
    ? 'waiting'
    : currentNode?.kind === 'choice'
      ? reactionFor(currentNode.options?.find((o) => o.id === selectedOptionId)?.scores)
      : 'approving';
  const counterpart = scenario?.nodes.find((n) => n.persona)?.persona;
  const progressPct =
    playableNodes.length > 0
      ? Math.round(((Math.max(0, currentIndex) + 1) / playableNodes.length) * 100)
      : 20;

  const submitCurrentStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runId || !currentNode) return;
    if (currentNode.kind === 'choice' && !selectedOptionId) return;
    if (currentNode.kind === 'free_text' && freeText.trim().length < 2) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/simulations/${encodeURIComponent(runId)}/step`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
        body: JSON.stringify({
          nodeId: currentNode.id,
          optionId: selectedOptionId,
          freeText,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          finished: boolean;
          nextNodeId?: string;
          stepFeedback: { ar: string; en: string; ruleIds: string[] };
        };
        setStepOutcome({
          feedback: locale === 'ar' ? data.stepFeedback.ar : data.stepFeedback.en,
          ruleIds: data.stepFeedback.ruleIds,
          finished: data.finished,
          nextNodeId: data.nextNodeId,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const advanceNext = () => {
    if (!stepOutcome) return;
    if (stepOutcome.finished && runId) {
      navigate(`/practice/report/${runId}`);
      return;
    }
    if (stepOutcome.nextNodeId) {
      setCurrentNodeId(stepOutcome.nextNodeId);
      setSelectedOptionId('');
      setFreeText('');
      setStepOutcome(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        {errorMsg && <ErrorBanner message={errorMsg} />}

        {!scenario && !errorMsg && <Skeleton className="h-64 w-full" />}

        {scenario && currentNode && (
          <>
            <header className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs text-[var(--ink-2)] tabular-nums">
                <DemoContentNotice text={t.practice.demoTag} compact />
                <span>
                  {t.practice.progress}: {currentIndex + 1} / {playableNodes.length}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--ink)]">
                {locale === 'ar' ? scenario.titleAr : scenario.titleEn}
              </h1>
              <div className="h-1.5 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--gold)] transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </header>

            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-5">
              <CounterpartStage
                reaction={reaction}
                ar={locale === 'ar'}
                name={(currentNode.persona ?? counterpart) ? (locale === 'ar' ? (currentNode.persona ?? counterpart)!.nameAr : (currentNode.persona ?? counterpart)!.nameEn) : undefined}
                role={(currentNode.persona ?? counterpart) ? (locale === 'ar' ? (currentNode.persona ?? counterpart)!.roleAr : (currentNode.persona ?? counterpart)!.roleEn) : undefined}
              />
              {currentNode.persona && (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-xs space-y-0.5">
                  <p className="font-semibold text-[var(--ink)]">
                    {locale === 'ar' ? currentNode.persona.nameAr : currentNode.persona.nameEn} ·{' '}
                    <span className="text-[var(--gold-ink)]">
                      {locale === 'ar' ? currentNode.persona.roleAr : currentNode.persona.roleEn}
                    </span>
                  </p>
                  <p className="text-[var(--ink-2)]">
                    {locale === 'ar' ? currentNode.persona.styleAr : currentNode.persona.styleEn}
                  </p>
                </div>
              )}

              <p className="text-base text-[var(--ink)] leading-relaxed font-medium">
                {locale === 'ar' ? currentNode.narrativeAr : currentNode.narrativeEn}
              </p>

              {!stepOutcome ? (
                <form onSubmit={(e) => void submitCurrentStep(e)} className="space-y-4">
                  {currentNode.kind === 'choice' ? (
                    <div className="space-y-2.5">
                      {(currentNode.options || []).map((opt) => {
                        const active = selectedOptionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedOptionId(opt.id)}
                            className={`w-full text-start p-4 rounded-xl border transition-colors text-sm leading-relaxed cursor-pointer ${
                              active
                                ? 'border-[var(--gold)] bg-[var(--surface-2)] text-[var(--ink)] font-medium'
                                : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:bg-[var(--surface-2)]/60'
                            }`}
                          >
                            {locale === 'ar' ? opt.textAr : opt.textEn}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-[var(--ink-2)]">
                        {t.practice.freeTextLabel}
                      </label>
                      {(currentNode.promptHintAr || currentNode.promptHintEn) && (
                        <p className="text-xs text-[var(--ink-3)]">
                          {locale === 'ar' ? currentNode.promptHintAr : currentNode.promptHintEn}
                        </p>
                      )}
                      <textarea
                        rows={4}
                        required
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5 text-sm text-[var(--ink)]"
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    loading={submitting}
                    disabled={
                      currentNode.kind === 'choice'
                        ? !selectedOptionId
                        : freeText.trim().length < 2
                    }
                  >
                    {t.practice.submitStep}
                  </Button>
                </form>
              ) : (
                <div className="rounded-xl border border-[var(--gold)]/55 bg-[var(--surface-2)] p-5 space-y-4">
                  <div className="flex items-start gap-2.5">
                    <BookOpen className="w-4 h-4 text-[var(--gold-ink)] shrink-0 mt-1" />
                    <div className="space-y-1.5">
                      <p className="text-sm text-[var(--ink)] leading-relaxed">
                        {stepOutcome.feedback}
                      </p>
                      {stepOutcome.ruleIds.length > 0 && (
                        <p className="text-xs font-mono text-[var(--ink-3)]" dir="ltr">
                          {stepOutcome.ruleIds.join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button variant="primary" onClick={advanceNext}>
                    {stepOutcome.finished ? t.practice.finishReport : t.practice.nextNode}
                  </Button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 3. Competency Report Page + SVG Radar & Longitudinal Infographics
// ---------------------------------------------------------------------------

export function SimulationReportPage() {
  const { runId } = useParams<{ runId: string }>();
  const { locale, t } = useI18n();
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedBridge, setDismissedBridge] = useState(false);
  const [pose, setPose] = useState('seated');
  const [no3d, setNo3d] = useState(false);

  useEffect(() => {
    if (!runId) return;
    fetch(`/api/simulations/${encodeURIComponent(runId)}/report`)
      .then(async (res) => {
        if (!res.ok) throw new Error('missing');
        const data = (await res.json()) as { report: SimulationReport };
        setReport(data.report);
      })
      .catch(() => setError(t.notFound.title));
  }, [runId, t.notFound.title]);

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-7">
        {error && <ErrorBanner message={error} />}
        {!report && !error && <Skeleton className="h-72 w-full" />}

        {report && (
          <>
            <header className="space-y-2">
              <DemoContentNotice text={t.practice.demoTag} compact />
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">
                {t.practice.reportTitle}
              </h1>
              <p className="text-sm text-[var(--ink-2)]">
                {locale === 'ar' ? report.scenarioTitleAr : report.scenarioTitleEn}
              </p>
            </header>

            {/* Mandatory Methodology Disclaimer (Section 14.3) */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--ink-2)] flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-[var(--gold-ink)] shrink-0" aria-hidden="true" />
              <span>{t.practice.disclaimer}</span>
            </div>

            {/* 3D reminder of the right posture, alongside the report */}
            {!no3d && (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3" aria-labelledby="sim-3d-h" data-testid="sim-3d">
                <h2 id="sim-3d-h" className="text-base font-semibold text-[var(--ink)]">
                  {locale === 'ar' ? 'شاهد الوضعية الصحيحة بثلاثة أبعاد' : 'See the right posture in 3D'}
                </h2>
                <PostureViewer pose={pose} ariaLabel={locale === 'ar' ? 'مجسم ثلاثي الأبعاد لوضعية الجسد' : '3D figure showing the body posture'} onUnsupported={() => setNo3d(true)} />
                <div className="flex flex-wrap gap-2" role="group" aria-label={locale === 'ar' ? 'الوضعيات' : 'Poses'}>
                  {POSE_INFO.map((p) => (
                    <button key={p.id} type="button" aria-pressed={pose === p.id} onClick={() => setPose(p.id)} className={`min-h-[40px] rounded-full border px-3.5 text-xs font-semibold cursor-pointer ${pose === p.id ? 'bg-[var(--primary)] text-[var(--bg)] border-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--ink-2)] border-[var(--line)]'}`}>
                      {locale === 'ar' ? p.ar : p.en}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-[var(--ink)] leading-relaxed">{locale === 'ar' ? POSE_INFO.find((p) => p.id === pose)?.tipAr : POSE_INFO.find((p) => p.id === pose)?.tipEn}</p>
                <Link to="/posture" className="text-sm font-semibold underline text-[var(--ink)]">{locale === 'ar' ? 'كل الوضعيات والمعرض ثلاثي الأبعاد' : 'All poses and the 3D showcase'}</Link>
              </section>
            )}

            <PassportSeals
              ar={locale === 'ar'}
              title={locale === 'ar' ? 'جواز وجاهة: الكفايات السبع' : 'Wijaha passport: the seven competencies'}
              items={(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'] as CompetencyCode[]).map((c) => {
                const hit = report.competencyBreakdown.find((cb) => cb.competency === c);
                return {
                  key: c,
                  code: c,
                  label: t.practice.competencies[c].replace(/^C\d\s*·\s*/, ''),
                  stamped: !!hit,
                  value: hit ? `${hit.pct}%` : undefined,
                  emptyNote: locale === 'ar' ? 'لم تُقيَّم في هذه الجلسة' : 'not assessed in this session',
                };
              })}
            />

            {/* Competency Infographic Breakdown (No single aggregate score headline!) */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* SVG Radar Polygon Infographic */}
              <div className="md:col-span-5 flex justify-center">
                <CompetencyRadarSvg items={report.competencyBreakdown} />
              </div>

              {/* Individual Competency Bars */}
              <div className="md:col-span-7 space-y-4">
                {report.competencyBreakdown.map((cb) => (
                  <div key={cb.competency} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--ink)]">
                        {t.practice.competencies[cb.competency]}
                      </span>
                      <span className="tabular-nums font-mono text-[var(--ink-2)]">
                        {cb.score} / {cb.maxScore} ({cb.pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          cb.pct >= 75
                            ? 'bg-[var(--success)]'
                            : cb.pct >= 50
                              ? 'bg-[var(--gold)]'
                              : 'bg-[var(--warning)]'
                        }`}
                        style={{ width: `${Math.max(8, cb.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Longitudinal Trend SVG Chart (if multiple runs recorded) */}
            {report.historyPoints && report.historyPoints.length > 1 && (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  <TrendingUp className="w-4 h-4 text-[var(--gold-ink)]" />
                  <span>{t.practice.progressOverTime}</span>
                </div>
                <div className="flex items-end gap-4 pt-2">
                  {report.historyPoints.map((pt) => (
                    <div key={pt.runIndex} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-xs font-mono tabular-nums text-[var(--ink-2)]">
                        {pt.avgPct}%
                      </span>
                      <div className="w-full max-w-[44px] h-24 bg-[var(--surface-2)] rounded-md flex items-end overflow-hidden">
                        <div
                          className="w-full bg-[var(--primary)] rounded-t-md"
                          style={{ height: `${Math.max(12, pt.avgPct)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[var(--ink-3)] tabular-nums">
                        #{pt.runIndex}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Strengths & Improvement Gaps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                  <Award className="w-4 h-4" />
                  <span>{t.practice.strengthsTitle}</span>
                </div>
                <ul className="space-y-2.5 text-sm text-[var(--ink)]">
                  {report.strengths.map((st, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0 mt-0.5" />
                      <span>{locale === 'ar' ? st.noteAr : st.noteEn}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-ink)]">
                  <Compass className="w-4 h-4" />
                  <span>{t.practice.gapsTitle}</span>
                </div>
                {report.gaps.length === 0 ? (
                  <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                    {locale === 'ar'
                      ? 'لم تُرصد فجوات حرجة في هذه الجلسة؛ يمكنك تجربة سيناريو بمستوى أعلى لتوسيع نطاق التحدي.'
                      : 'No critical gaps observed in this session; try a higher-level scenario to test additional competencies.'}
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm text-[var(--ink)]">
                    {report.gaps.map((gp, idx) => (
                      <li key={idx} className="space-y-1">
                        <p className="font-medium">{locale === 'ar' ? gp.noteAr : gp.noteEn}</p>
                        <p className="text-xs text-[var(--ink-2)]">
                          {locale === 'ar' ? gp.exampleAr : gp.exampleEn}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Step-by-Step Protocol Explanations */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
              <h2 className="text-base font-semibold text-[var(--ink)]">
                {t.practice.whyCorrectTitle}
              </h2>
              <div className="divide-y divide-[var(--line)]">
                {report.explanations.map((ex, idx) => (
                  <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                    <p className="text-sm text-[var(--ink)] leading-relaxed">
                      {locale === 'ar' ? ex.feedbackAr : ex.feedbackEn}
                    </p>
                    {ex.ruleIds.length > 0 && (
                      <p className="text-xs font-mono text-[var(--ink-3)]" dir="ltr">
                        {ex.ruleIds.join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Expert Bridge if repeated competency gap */}
            {report.expertBridgeSuggestion && !dismissedBridge && (
              <ExpertBridgeCard
                suggestion={report.expertBridgeSuggestion}
                onDismiss={() => setDismissedBridge(true)}
              />
            )}

            <div className="flex flex-wrap gap-3">
              {report.recommendedNextScenarioId && (
                <Link to={`/practice/${report.recommendedNextScenarioId}`}>
                  <Button variant="primary">
                    {locale === 'ar' ? 'انتقل للسيناريو التالي المقترح' : 'Try Next Recommended Scenario'}
                  </Button>
                </Link>
              )}
              <Link to="/practice">
                <Button variant="secondary">{t.nav.practice}</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

const ALL_COMPETENCY_AXES: CompetencyCode[] = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];

function CompetencyRadarSvg({
  items,
}: {
  items: SimulationReport['competencyBreakdown'];
}) {
  const size = 232;
  const center = size / 2;
  const radius = 78;
  const itemMap = new Map(items.map((it) => [it.competency, it.pct]));
  const axes = ALL_COMPETENCY_AXES.map((code) => ({
    code,
    assessed: itemMap.has(code),
    // D1: never invent a value for a competency that was not assessed in this session
    pct: itemMap.get(code) ?? null,
  }));
  const count = axes.length;

  const getPoint = (idx: number, pct: number) => {
    const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, pct)) / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      ax: center + radius * Math.cos(angle),
      ay: center + radius * Math.sin(angle),
      lx: center + (radius + 20) * Math.cos(angle),
      ly: center + (radius + 20) * Math.sin(angle),
    };
  };

  const assessedAxes = axes
    .map((ax, idx) => ({ ...ax, idx }))
    .filter((ax): ax is typeof ax & { pct: number } => ax.pct !== null);
  // Only connect real scores; with fewer than 3 assessed axes a polygon would imply data that does not exist.
  const polygonPoints =
    assessedAxes.length >= 3
      ? assessedAxes
          .map((ax) => {
            const pt = getPoint(ax.idx, ax.pct);
            return `${pt.x},${pt.y}`;
          })
          .join(' ')
      : null;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-56 h-56 select-none" aria-hidden="true">
      {[0.33, 0.66, 1].map((ring) => (
        <circle
          key={ring}
          cx={center}
          cy={center}
          r={radius * ring}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
        />
      ))}
      {axes.map((ax, idx) => {
        const pt = getPoint(idx, 100);
        return (
          <line
            key={`spoke-${ax.code}`}
            x1={center}
            y1={center}
            x2={pt.ax}
            y2={pt.ay}
            stroke="var(--line)"
            strokeDasharray="2 2"
            strokeWidth="1"
          />
        );
      })}
      {polygonPoints && (
        <polygon
          points={polygonPoints}
          fill="rgba(176, 141, 87, 0.22)"
          stroke="var(--gold)"
          strokeWidth="2"
        />
      )}
      {assessedAxes.map((ax) => {
        const pt = getPoint(ax.idx, ax.pct);
        return (
          <line
            key={`value-${ax.code}`}
            x1={center}
            y1={center}
            x2={pt.x}
            y2={pt.y}
            stroke="var(--gold)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
      {axes.map((ax, idx) => {
        const pt = getPoint(idx, ax.pct ?? 0);
        return (
          <g key={ax.code}>
            {ax.pct !== null && <circle cx={pt.x} cy={pt.y} r="4" fill="var(--primary)" />}
            <text
              x={pt.lx}
              y={pt.ly + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight={ax.assessed ? '700' : '500'}
              fill={ax.assessed ? 'var(--ink)' : 'var(--ink-3)'}
            >
              {ax.code}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

