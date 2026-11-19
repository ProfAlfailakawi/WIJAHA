import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpenCheck,
  Download,
  FileSpreadsheet,
  Flag,
  GraduationCap,
  Share2,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { ExpertBridgeCard, ResultBlockRenderer } from '../components/result-blocks/ResultBlocks';
import {
  Button,
  DemoContentNotice,
  Dialog,
  ErrorBanner,
  RuleLevelTag,
  Skeleton,
  ToastNotice,
} from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n } from '../lib/i18n';
import type { Action, ResultBlock, WijahaResult } from '../shared/types';

export function ResultPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const { locale, dir, t } = useI18n();
  const { state, openSignInModal, getBearerHeaders, refreshAuth } = useAuth();
  const navigate = useNavigate();

  const [streamStage, setStreamStage] = useState<'understanding' | 'retrieving' | 'generating' | null>(
    null,
  );
  const [result, setResult] = useState<WijahaResult | null>(null);
  const [partialSummary, setPartialSummary] = useState<string[]>([]);
  const [partialBlocks, setPartialBlocks] = useState<ResultBlock[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planLimitInfo, setPlanLimitInfo] = useState<{
    used: number;
    limit: number;
    resetDate: string;
  } | null>(null);

  const [editingChipKey, setEditingChipKey] = useState<string | null>(null);
  const [editingChipVal, setEditingChipVal] = useState<string>('');
  const [clarificationSkipped, setClarificationSkipped] = useState(false);
  const [refining, setRefining] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);

  const [sourcesDrawerOpen, setSourcesDrawerOpen] = useState(false);
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);

  const [feedbackSent, setFeedbackSent] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [followupText, setFollowupText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [expertDismissed, setExpertDismissed] = useState(false);

  const runLiveStreamQuery = useCallback(
    async (qText: string) => {
      setErrorMsg(null);
      setPlanLimitInfo(null);
      setResult(null);
      setPartialSummary([]);
      setPartialBlocks([]);
      setStreamStage('understanding');

      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...getBearerHeaders(),
          },
          body: JSON.stringify({ query: qText, locale }),
        });

        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as {
            error?: { code?: string; used?: number; limit?: number; resetDate?: string };
          };
          if (errJson.error?.code === 'PLAN_LIMIT_REACHED') {
            setPlanLimitInfo({
              used: errJson.error.used ?? 15,
              limit: errJson.error.limit ?? 15,
              resetDate: errJson.error.resetDate ?? '',
            });
          } else {
            setErrorMsg(t.home.networkError);
          }
          setStreamStage(null);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          const fallback = (await res.json()) as { result: WijahaResult };
          setResult(fallback.result);
          setStreamStage(null);
          navigate(`/r/${fallback.result.id}`, { replace: true });
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const frame of parts) {
            const lines = frame.split('\n');
            const eventLine = lines.find((l) => l.startsWith('event:'));
            const dataLine = lines.find((l) => l.startsWith('data:'));
            if (!eventLine || !dataLine) continue;

            const evt = eventLine.slice(6).trim();
            const payload = JSON.parse(dataLine.slice(5).trim());

            if (evt === 'stage') {
              setStreamStage(payload.stage);
            } else if (evt === 'summary') {
              setPartialSummary(payload.summary || []);
            } else if (evt === 'block') {
              setPartialBlocks((prev) => [...prev, payload.block]);
            } else if (evt === 'done' && payload.result) {
              const finalRes = payload.result as WijahaResult;
              setResult(finalRes);
              setStreamStage(null);
              void refreshAuth();
              navigate(`/r/${finalRes.id}`, { replace: true });
            } else if (evt === 'error') {
              setErrorMsg(t.home.networkError);
              setStreamStage(null);
            }
          }
        }
      } catch {
        setErrorMsg(t.home.networkError);
        setStreamStage(null);
      }
    },
    [getBearerHeaders, locale, navigate, refreshAuth, t.home.networkError],
  );

  const fetchStoredResult = useCallback(
    async (id: string) => {
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/results/${encodeURIComponent(id)}`, {
          credentials: 'include',
          headers: getBearerHeaders(),
        });
        if (!res.ok) {
          setErrorMsg(t.notFound.title);
          return;
        }
        const data = (await res.json()) as { result: WijahaResult };
        setResult(data.result);
        const dismissedKey = `wijaha_dismiss_expert_${data.result.id}`;
        setExpertDismissed(window.localStorage.getItem(dismissedKey) === '1');
      } catch {
        setErrorMsg(t.home.networkError);
      }
    },
    [getBearerHeaders, t.home.networkError, t.notFound.title],
  );

  useEffect(() => {
    if (resultId === 'live' && queryParam) {
      void runLiveStreamQuery(queryParam);
    } else if (resultId && resultId !== 'live') {
      void fetchStoredResult(resultId);
    }
  }, [resultId, queryParam, runLiveStreamQuery, fetchStoredResult]);

  const handleRefine = async (opts: {
    clarificationAnswer?: string;
    followup?: string;
    overrideContext?: Record<string, string>;
    elevateToHighSensitivity?: boolean;
  }) => {
    if (!result) return;
    setRefining(true);
    try {
      const res = await fetch(`/api/results/${encodeURIComponent(result.id)}/refine`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getBearerHeaders(),
        },
        body: JSON.stringify({
          locale,
          clarificationAnswer: opts.clarificationAnswer,
          followupText: opts.followup,
          overrideContext: opts.overrideContext,
          elevateToHighSensitivity: opts.elevateToHighSensitivity,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { result: WijahaResult };
        setResult(data.result);
        setFollowupText('');
        setEditingChipKey(null);
      }
    } finally {
      setRefining(false);
    }
  };

  const performSaveProject = async () => {
    if (!result) return;
    setSavingProject(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getBearerHeaders(),
        },
        body: JSON.stringify({ resultId: result.id, title: result.title }),
      });
      if (res.status === 403) {
        const err = await res.json().catch(() => ({}));
        if (err?.error?.code === 'PROJECTS_LIMIT_REACHED') {
          setToast(
            locale === 'ar'
              ? 'وصلت إلى حد المشاريع في باقتك الحالية. يمكنك الترقية لحفظ مشاريع إضافية.'
              : 'Project limit reached on your current plan. Upgrade to save more projects.',
          );
          return;
        }
      }
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        void refreshAuth();
        navigate(`/projects/${data.id}`);
      }
    } finally {
      setSavingProject(false);
    }
  };

  const performExport = async (format: 'pdf' | 'docx') => {
    if (!result) return;
    setExportingFormat(format);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getBearerHeaders(),
        },
        body: JSON.stringify({ resultId: result.id, format }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const extMatch = disp.match(/filename="([^"]+)"/);
      const filename = extMatch ? extMatch[1] : `wijaha-plan.${format === 'docx' ? 'docx' : 'html'}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportingFormat(null);
    }
  };

  const executeResultAction = (action: Action) => {
    if (action.id === 'save_project') {
      if (!state.authenticated) {
        openSignInModal(() => void performSaveProject());
      } else {
        void performSaveProject();
      }
      return;
    }
    if (action.id === 'export_pdf') {
      if (!state.authenticated) {
        openSignInModal(() => void performExport('pdf'));
      } else {
        void performExport('pdf');
      }
      return;
    }
    if (action.id === 'export_docx') {
      if (!state.authenticated) {
        openSignInModal(() => void performExport('docx'));
      } else {
        void performExport('docx');
      }
      return;
    }
    if (action.id === 'share') {
      const shareUrl = window.location.href;
      void navigator.clipboard.writeText(shareUrl);
      setToast(t.projects.shareCopied);
      return;
    }
    if (action.id === 'practice') {
      navigate(action.targetUrl || '/practice');
      return;
    }
    if (action.id === 'request_expert') {
      navigate(action.targetUrl || '/experts');
      return;
    }
    if (action.id === 'followup') {
      document.getElementById('wijaha-followup-input')?.focus();
    }
  };

  const submitFeedback = async (rating: 'up' | 'down', reportedError = false, comment?: string) => {
    if (!result) return;
    await fetch('/api/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
      body: JSON.stringify({
        resultId: result.id,
        rating,
        reportedError,
        comment,
        ruleIds: result.trust.ruleIds,
      }),
    });
    setFeedbackSent(true);
    setReportModalOpen(false);
    setReportText('');
    setToast(t.result.trust.feedbackSaved);
  };

  const inspectRule = (ruleId: string) => {
    setHighlightedRuleId(ruleId);
    setSourcesDrawerOpen(true);
  };

  const FollowupIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 pb-24 sm:pb-14">
        {/* Plan Limit Calm Banner */}
        {planLimitInfo && (
          <div className="rounded-xl border border-[var(--gold)] bg-[var(--surface)] p-6 space-y-3">
            <h2 className="text-lg font-semibold text-[var(--ink)]">
              {locale === 'ar'
                ? `استخدمت الحد الشهري لباقتك (${planLimitInfo.used}/${planLimitInfo.limit})`
                : `Monthly plan limit reached (${planLimitInfo.used}/${planLimitInfo.limit})`}
            </h2>
            <p className="text-sm text-[var(--ink-2)]">
              {locale === 'ar'
                ? `يتجدد رصيدك تلقائياً في ${planLimitInfo.resetDate}، أو يمكنك الترقية الفورية للمتابعة دون انقطاع.`
                : `Your quota resets on ${planLimitInfo.resetDate}, or upgrade now to continue immediately.`}
            </p>
            <Button variant="primary" onClick={() => navigate('/pricing')}>
              {t.nav.pricing}
            </Button>
          </div>
        )}

        {/* Network / Fetch Error */}
        {errorMsg && (
          <ErrorBanner
            message={errorMsg}
            retryLabel={t.home.retry}
            onRetry={() => {
              if (queryParam) void runLiveStreamQuery(queryParam);
              else if (resultId) void fetchStoredResult(resultId);
            }}
          />
        )}

        {/* Progressive Live Streaming Status (aria-live="polite" — Section 7.6 & 8.2) */}
        {streamStage && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-sm font-medium text-[var(--gold-ink)]">
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t.result.streaming[streamStage]}</span>
            </div>

            {partialSummary.length > 0 ? (
              <ul className="space-y-2 text-sm text-[var(--ink)]">
                {partialSummary.map((s, idx) => (
                  <li key={idx}>• {s}</li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2.5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            )}

            {partialBlocks.map((b, idx) => (
              <ResultBlockRenderer key={idx} block={b} blockIndex={idx} />
            ))}
          </div>
        )}

        {/* Completed Transformative Result */}
        {result && (
          <>
            {/* 1. Context Header + Editable Chips + Editable Assumption */}
            <header className="v2-hero !rounded-[28px] px-6 sm:px-10 pt-9 pb-8 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[0.72rem] tracking-[0.35em] text-[var(--gold)] uppercase">
                  {locale === 'ar' ? 'ملف المناسبة' : 'Occasion dossier'}
                </span>
                <span className="inline-flex items-center gap-2 text-xs text-[color:var(--primary-fg)]/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" aria-hidden="true" />
                  {refining ? t.result.streaming.generating : t.result.demoRuleBadge}
                </span>
              </div>

              <h1 className="text-3xl sm:text-[2.6rem] leading-[1.3] text-[var(--primary-fg)]">
                {result.title}
              </h1>

              {result.context.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {result.context.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => {
                        if (!chip.editable) return;
                        setEditingChipKey(chip.key);
                        setEditingChipVal(chip.label);
                      }}
                      title={chip.editable ? t.result.editChipPrompt : undefined}
                      className="min-h-[36px] px-3.5 rounded-full border border-[var(--gold)]/45 text-[color:var(--primary-fg)] hover:bg-white/5 text-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>{chip.label}</span>
                      {chip.editable && <SlidersHorizontal className="w-3 h-3 text-[var(--gold)]" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </header>

            <div className="space-y-4">
              {editingChipKey && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRefine({
                      overrideContext: { [editingChipKey]: editingChipVal },
                      followup: editingChipVal,
                    });
                  }}
                  className="rounded-lg border border-[var(--gold)] bg-[var(--surface)] p-3 flex flex-wrap items-center gap-2"
                >
                  <span className="text-xs text-[var(--ink-2)]">{t.result.editChipPrompt}</span>
                  <input
                    type="text"
                    value={editingChipVal}
                    onChange={(e) => setEditingChipVal(e.target.value)}
                    className="flex-1 min-w-[180px] min-h-[38px] rounded border border-[var(--line)] bg-[var(--bg)] px-2.5 text-sm text-[var(--ink)]"
                  />
                  <Button type="submit" size="sm" loading={refining}>
                    {t.result.apply}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingChipKey(null)}
                  >
                    {t.result.cancel}
                  </Button>
                </form>
              )}

              {/* Editable Assumption Line */}
              {result.assumptions.map((assump) => (
                <div
                  key={assump.id}
                  className="text-xs text-[var(--ink-2)] flex flex-wrap items-center gap-2"
                >
                  <span className="text-[var(--ink-3)]">{t.result.assumptionPrefix}</span>
                  <span>{assump.text}</span>
                  {assump.editable && assump.alternativeText && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleRefine({
                          followup: assump.alternativeText,
                          elevateToHighSensitivity: true,
                        })
                      }
                      className="text-[var(--gold-ink)] font-semibold underline underline-offset-2 cursor-pointer"
                    >
                      {t.result.changeAssumption} ({assump.alternativeText})
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* High-Sensitivity Mandatory Notice */}
            {result.trust.sensitivity === 'high' && (
              <div className="rounded-xl border border-[var(--gold)]/55 bg-[var(--surface-2)] p-4 flex items-start gap-3 text-sm text-[var(--ink)]">
                <AlertTriangle className="w-5 h-5 text-[var(--gold-ink)] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t.result.highSensitivityAlert}</span>
              </div>
            )}

            {/* 2. Max ONE Clarifying Question with Clickable Options + Skip */}
            {result.clarification && !clarificationSkipped && (
              <section className="rounded-xl border border-[var(--gold)]/50 bg-[var(--surface)] p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--gold-ink)]">
                    {t.result.clarificationTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => setClarificationSkipped(true)}
                    className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2 py-1 cursor-pointer"
                  >
                    {t.result.skip}
                  </button>
                </div>
                <p className="text-sm font-medium text-[var(--ink)]">
                  {result.clarification.question}
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.clarification.options.map((opt) => (
                    <Button
                      key={opt}
                      variant="secondary"
                      size="sm"
                      loading={refining}
                      onClick={() =>
                        void handleRefine({
                          clarificationAnswer: opt,
                          followup: opt,
                        })
                      }
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Direct 3-Point Executive Summary */}
            <section>
              <h2 className="text-xl sm:text-2xl text-[var(--ink)] mb-4">{t.result.summaryTitle}</h2>
              <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.summary.map((line, idx) => {
                  const tn = ['gold', 'teal', 'indigo'][idx % 3];
                  return (
                    <li key={idx} className="v2-card p-5 flex flex-col gap-3">
                      <span className="v2-ico w-12 h-12 text-xl font-bold tabular-nums" style={{ background: `var(--t-${tn})`, color: `var(--c-${tn})` }}>{idx + 1}</span>
                      <span className="text-[0.98rem] leading-relaxed text-[var(--ink)]">{line}</span>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* 4. Transformative Result Blocks */}
            <div className="space-y-5">
              {result.blocks.map((block, idx) => (
                <ResultBlockRenderer
                  key={idx}
                  block={block}
                  blockIndex={idx}
                  onInspectRule={inspectRule}
                />
              ))}
            </div>

            {/* 5. Action Bar: ONE Primary Button + Calm Secondary Actions */}
            <section className="no-print rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  loading={savingProject || exportingFormat === 'pdf'}
                  onClick={() => executeResultAction(result.primaryAction)}
                >
                  {result.primaryAction.id === 'export_pdf' ? (
                    <Download className="w-4 h-4" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                  <span>{result.primaryAction.label}</span>
                </Button>

                {/* Explicit Save & DOCX buttons if not already primary */}
                {result.primaryAction.id !== 'save_project' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={savingProject}
                    onClick={() =>
                      executeResultAction({ id: 'save_project', label: t.result.actions.saveProject })
                    }
                  >
                    <Bookmark className="w-4 h-4" />
                    <span>{t.result.actions.saveProject}</span>
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  loading={exportingFormat === 'docx'}
                  onClick={() =>
                    executeResultAction({ id: 'export_docx', label: t.result.actions.exportDocx })
                  }
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{t.result.actions.exportDocx}</span>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => executeResultAction({ id: 'share', label: t.result.actions.share })}
                >
                  <Share2 className="w-4 h-4" />
                  <span>{t.result.actions.share}</span>
                </Button>
                {result.primaryAction.id !== 'practice' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      executeResultAction({
                        id: 'practice',
                        label: t.result.actions.practice,
                        targetUrl: '/practice',
                      })
                    }
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>{t.result.actions.practice}</span>
                  </Button>
                )}
              </div>
            </section>

            {/* Mobile Sticky Primary CTA */}
            <div className="no-print sm:hidden fixed bottom-0 inset-x-0 z-20 border-t border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-xs p-3">
              <Button
                variant="primary"
                className="w-full"
                loading={savingProject || exportingFormat !== null}
                onClick={() => executeResultAction(result.primaryAction)}
              >
                {result.primaryAction.label}
              </Button>
            </div>

            {/* 6. Calm Trust, Sources & Feedback Bar */}
            <section className="no-print rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-2)]">
                <div className="flex flex-wrap items-center gap-2">
                  <BookOpenCheck className="w-4 h-4 text-[var(--gold-ink)]" aria-hidden="true" />
                  <span className="tabular-nums">
                    {t.result.trust.basedOn} {result.trust.ruleIds.length} {t.result.trust.rulesCount}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{t.result.trust.demoNotice}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setHighlightedRuleId(null);
                    setSourcesDrawerOpen(true);
                  }}
                  className="font-semibold text-[var(--ink)] underline underline-offset-4 cursor-pointer"
                >
                  {t.result.trust.sourcesBtn}
                </button>
              </div>

              {result.trust.unreviewedClaims > 0 && (
                <p className="text-xs text-[var(--ink-3)]">{t.result.trust.unreviewedWarning}</p>
              )}

              <div className="pt-3 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-[var(--ink-2)]">{t.result.trust.helpfulPrompt}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={feedbackSent}
                    onClick={() => void submitFeedback('up')}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{t.result.trust.helpfulYes}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={feedbackSent}
                    onClick={() => void submitFeedback('down')}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>{t.result.trust.helpfulNo}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReportModalOpen(true)}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{t.result.trust.reportError}</span>
                  </Button>
                </div>
              </div>
            </section>

            {/* 7. Post-Result Expert Bridge (Only when not already shown as an expert_review block & not dismissed) */}
            {result.expertSuggestion &&
              !expertDismissed &&
              !result.blocks.some((b) => b.type === 'expert_review') && (
                <ExpertBridgeCard
                  suggestion={result.expertSuggestion}
                  onDismiss={() => {
                    setExpertDismissed(true);
                    window.localStorage.setItem(`wijaha_dismiss_expert_${result.id}`, '1');
                  }}
                />
              )}

            {/* 8. Quiet Follow-Up Input at Bottom */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!followupText.trim()) return;
                void handleRefine({ followup: followupText.trim() });
              }}
              className="no-print flex gap-2 pt-2"
            >
              <input
                id="wijaha-followup-input"
                type="text"
                value={followupText}
                onChange={(e) => setFollowupText(e.target.value)}
                placeholder={t.result.followupPlaceholder}
                className="flex-1 min-w-0 min-h-[46px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--ink)]"
              />
              <Button type="submit" variant="secondary" loading={refining}>
                <span>{t.result.followupSend}</span>
                <FollowupIcon className="w-4 h-4" />
              </Button>
            </form>
          </>
        )}
      </div>

      {/* Sources & Rules Drawer Dialog */}
      <Dialog
        open={sourcesDrawerOpen}
        onClose={() => setSourcesDrawerOpen(false)}
        title={t.result.trust.sourcesBtn}
        subtitle={t.result.trust.demoNotice}
      >
        <div className="space-y-3">
          {(result?.trust.sourcesDetail || []).map((src) => (
            <div
              key={src.ruleId}
              className={`rounded-lg border p-3.5 space-y-1.5 ${
                highlightedRuleId === src.ruleId
                  ? 'border-[var(--gold)] bg-[var(--surface-2)]'
                  : 'border-[var(--line)] bg-[var(--bg)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-[var(--ink)]" dir="ltr">
                  {src.ruleId}
                </span>
                <RuleLevelTag level={src.level} label={t.result.levels[src.level]} />
              </div>
              <p className="text-sm font-medium text-[var(--ink)]">{src.ruleTitle}</p>
              <p className="text-xs text-[var(--ink-3)]">
                {src.sourceTitle} · <span className="font-mono">{src.status}</span>
              </p>
            </div>
          ))}
        </div>
      </Dialog>

      {/* Report Error Dialog */}
      <Dialog
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title={t.result.trust.reportError}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitFeedback('down', true, reportText);
          }}
          className="space-y-4"
        >
          <textarea
            required
            rows={4}
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder={t.result.trust.reportPlaceholder}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-sm text-[var(--ink)]"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setReportModalOpen(false)}>
              {t.result.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {t.result.trust.submitReport}
            </Button>
          </div>
        </form>
      </Dialog>

      <ToastNotice message={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}
