import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FolderKanban,
  History,
  RotateCcw,
  Save,
  Search,
  Share2,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { ExpertBridgeCard, ResultBlockRenderer } from '../components/result-blocks/ResultBlocks';
import {
  Button,
  DemoContentNotice,
  Dialog,
  EmptyState,
  ErrorBanner,
  Skeleton,
  ToastNotice,
} from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n } from '../lib/i18n';
import type { ResultBlock, WijahaResult } from '../shared/types';

interface ProjectRow {
  id: string;
  title: string;
  intent: string;
  currentVersionId: string;
  dismissedExpertTriggers: string[];
  updatedAt: string;
}

interface ProjectVersionRow {
  id: string;
  versionNumber: number;
  payload: WijahaResult;
  changeSummary: string;
  diffSummary: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 1. Saved Projects List (/projects)
// ---------------------------------------------------------------------------

export function ProjectsListPage() {
  const { locale, t } = useI18n();
  const { state, loading: authLoading, openSignInModal, getBearerHeaders } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const loadProjects = useCallback(async () => {
    if (!state.authenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        credentials: 'include',
        headers: getBearerHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as { projects: ProjectRow[] };
        setProjects(data.projects || []);
      }
    } finally {
      setLoading(false);
    }
  }, [getBearerHeaders, state.authenticated]);

  useEffect(() => {
    if (!authLoading) {
      void loadProjects();
    }
  }, [authLoading, loadProjects]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.title.toLowerCase().includes(q));
  }, [projects, filter]);

  return (
    <AppShell>
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">{t.projects.title}</h1>

          {projects.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search
                className="w-4 h-4 text-[var(--ink-3)] absolute top-3.5 start-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t.projects.searchPlaceholder}
                className="w-full min-h-[42px] rounded-xl border border-[var(--line)] bg-[var(--surface)] ps-10 pe-3.5 text-sm text-[var(--ink)]"
              />
            </div>
          )}
        </div>

        {!state.authenticated && !authLoading ? (
          <EmptyState
            icon={<FolderKanban className="w-5 h-5" />}
            title={t.auth.dialogTitle}
            description={t.auth.dialogSubtitle}
            action={
              <Button variant="primary" onClick={() => openSignInModal()}>
                {t.nav.signIn}
              </Button>
            }
          />
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="w-5 h-5" />}
            title={t.projects.empty}
            action={
              <Button variant="primary" onClick={() => navigate('/')}>
                {t.projects.goHome}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((proj) => (
              <Link
                key={proj.id}
                to={`/projects/${proj.id}`}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--gold)] transition-colors p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <p className="text-xs text-[var(--gold-ink)] font-medium">{proj.intent}</p>
                  <h2 className="text-base font-semibold text-[var(--ink)] leading-snug">
                    {proj.title}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--ink-3)] tabular-nums">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {t.projects.lastUpdated}{' '}
                    {new Date(proj.updatedAt).toLocaleDateString(
                      locale === 'ar' ? 'ar-KW' : 'en-US',
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 2. Interactive Project Workspace (/projects/:id)
// ---------------------------------------------------------------------------

export function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useI18n();
  const { getBearerHeaders } = useAuth();

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [versions, setVersions] = useState<ProjectVersionRow[]>([]);
  const [workingPayload, setWorkingPayload] = useState<WijahaResult | null>(null);
  const [workingTitle, setWorkingTitle] = useState('');
  const [dirty, setDirty] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingSmart, setUpdatingSmart] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  const [smartInstruction, setSmartInstruction] = useState('');
  const [latestDiff, setLatestDiff] = useState<string[]>([]);
  const [versionsDrawerOpen, setVersionsDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        credentials: 'include',
        headers: getBearerHeaders(),
      });
      if (!res.ok) {
        setErrorMsg(
          res.status === 403
            ? locale === 'ar'
              ? 'ليس لديك صلاحية للوصول إلى هذا المشروع.'
              : 'Access denied to this workspace.'
            : t.notFound.title,
        );
        return;
      }
      const data = (await res.json()) as {
        project: ProjectRow;
        currentVersion: ProjectVersionRow;
        versions: ProjectVersionRow[];
      };
      setProject(data.project);
      setVersions(data.versions);
      setWorkingPayload(data.currentVersion.payload);
      setWorkingTitle(data.project.title);
      setLatestDiff(data.currentVersion.diffSummary || []);
      setDirty(false);
    } catch {
      setErrorMsg(t.home.networkError);
    } finally {
      setLoading(false);
    }
  }, [getBearerHeaders, id, locale, t.home.networkError, t.notFound.title]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handleBlockChange = (index: number, nextBlock: ResultBlock) => {
    if (!workingPayload) return;
    const nextBlocks = workingPayload.blocks.map((b, i) => (i === index ? nextBlock : b));
    setWorkingPayload({ ...workingPayload, blocks: nextBlocks });
    setDirty(true);
  };

  const handleSaveManualVersion = async () => {
    if (!project || !workingPayload) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getBearerHeaders(),
        },
        body: JSON.stringify({
          title: workingTitle,
          payload: { ...workingPayload, title: workingTitle.slice(0, 80) },
          changeSummary: locale === 'ar' ? 'حفظ تعديلات مباشرة في مساحة العمل' : 'Saved manual workspace edits',
        }),
      });
      if (res.ok) {
        await loadWorkspace();
        setToast(locale === 'ar' ? 'تم حفظ الإصدار الجديد بنجاح.' : 'New version saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleNaturalUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || smartInstruction.trim().length < 3) return;
    setUpdatingSmart(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/update`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getBearerHeaders(),
        },
        body: JSON.stringify({ instruction: smartInstruction.trim(), locale }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          updated: WijahaResult;
          diffSummary: string[];
        };
        setSmartInstruction('');
        await loadWorkspace();
        setLatestDiff(data.diffSummary);
        setToast(locale === 'ar' ? 'تم تحديث الخطة وتسجيل الفروقات.' : 'Plan updated with diff log.');
      }
    } finally {
      setUpdatingSmart(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!project) return;
    const res = await fetch(
      `/api/projects/${encodeURIComponent(project.id)}/restore/${encodeURIComponent(versionId)}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: getBearerHeaders(),
      },
    );
    if (res.ok) {
      setVersionsDrawerOpen(false);
      await loadWorkspace();
      setToast(locale === 'ar' ? 'تمت استعادة الإصدار المحدد.' : 'Selected version restored.');
    }
  };

  const handleShareLink = async () => {
    if (!project) return;
    const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/share`, {
      method: 'POST',
      credentials: 'include',
      headers: getBearerHeaders(),
    });
    if (res.ok) {
      const data = (await res.json()) as { token: string };
      const url = `${window.location.origin}/share/${data.token}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setToast(t.projects.shareCopied);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!project) return;
    setExporting(format);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getBearerHeaders(),
        },
        body: JSON.stringify({ projectId: project.id, format }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const extMatch = disp.match(/filename="([^"]+)"/);
      const filename = extMatch ? extMatch[1] : `wijaha-project.${format === 'docx' ? 'docx' : 'html'}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  const handleDismissExpert = async () => {
    if (!project || !workingPayload?.expertSuggestion) return;
    const trigger = workingPayload.expertSuggestion.trigger;
    await fetch(`/api/projects/${encodeURIComponent(project.id)}/dismiss-expert`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
      body: JSON.stringify({ trigger }),
    });
    setProject({
      ...project,
      dismissedExpertTriggers: [...project.dismissedExpertTriggers, trigger],
    });
  };

  const currentVersionNumber =
    versions.find((v) => v.id === project?.currentVersionId)?.versionNumber ?? 1;

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {errorMsg && <ErrorBanner message={errorMsg} />}

        {project && workingPayload && (
          <>
            {/* Workspace Header */}
            <header className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-[var(--ink-3)] tabular-nums">
                  <DemoContentNotice text={t.result.demoRuleBadge} compact />
                  <span>·</span>
                  <span className="font-semibold text-[var(--gold-ink)]">
                    v{currentVersionNumber}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setVersionsDrawerOpen(true)}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>
                      {t.projects.versions} ({versions.length})
                    </span>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void handleShareLink()}>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{t.result.actions.share}</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={exporting === 'pdf'}
                    onClick={() => void handleExport('pdf')}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={exporting === 'docx'}
                    onClick={() => void handleExport('docx')}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>DOCX</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="text"
                  value={workingTitle}
                  onChange={(e) => {
                    setWorkingTitle(e.target.value);
                    setDirty(true);
                  }}
                  aria-label={locale === 'ar' ? 'عنوان المشروع' : 'Project title'}
                  className="flex-1 text-xl sm:text-2xl font-bold text-[var(--ink)] bg-[var(--surface)] border border-[var(--line)] rounded-xl px-4 py-2.5"
                />

                {dirty && (
                  <Button
                    variant="primary"
                    loading={saving}
                    onClick={() => void handleSaveManualVersion()}
                  >
                    <Save className="w-4 h-4" />
                    <span>{t.projects.saveEdits}</span>
                  </Button>
                )}
              </div>
            </header>

            {/* "Update Plan" Natural-Language Engine (Section 8.3) */}
            <section className="rounded-xl border border-[var(--gold)]/45 bg-[var(--surface)] p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Sparkles className="w-4 h-4 text-[var(--gold-ink)]" aria-hidden="true" />
                <span>{t.projects.updatePlanTitle}</span>
              </div>
              <form onSubmit={(e) => void handleNaturalUpdate(e)} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={smartInstruction}
                  onChange={(e) => setSmartInstruction(e.target.value)}
                  placeholder={t.projects.updatePlanPlaceholder}
                  className="flex-1 min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
                />
                <Button type="submit" variant="primary" loading={updatingSmart}>
                  {t.projects.updatePlanBtn}
                </Button>
              </form>

              {latestDiff.length > 0 && (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-1.5">
                  <p className="text-xs font-semibold text-[var(--gold-ink)]">
                    {t.projects.whatChanged}
                  </p>
                  <ul className="space-y-1 text-xs text-[var(--ink)]">
                    {latestDiff.map((d, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0 mt-0.5" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Summary */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/65 p-5 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-ink)]">
                {t.result.summaryTitle}
              </h2>
              <ul className="space-y-1.5 text-sm text-[var(--ink)]">
                {workingPayload.summary.map((s, idx) => (
                  <li key={idx}>• {s}</li>
                ))}
              </ul>
            </section>

            {/* Editable Blocks */}
            <div className="space-y-5">
              {workingPayload.blocks.map((block, idx) => (
                <ResultBlockRenderer
                  key={idx}
                  block={block}
                  blockIndex={idx}
                  editable
                  projectId={project.id}
                  onUpdateBlock={handleBlockChange}
                />
              ))}
            </div>

            {/* Persistent Post-Project Expert Bridge */}
            {workingPayload.expertSuggestion &&
              !workingPayload.blocks.some((b) => b.type === 'expert_review') &&
              !project.dismissedExpertTriggers.includes(workingPayload.expertSuggestion.trigger) && (
                <ExpertBridgeCard
                  suggestion={workingPayload.expertSuggestion}
                  projectId={project.id}
                  onDismiss={() => void handleDismissExpert()}
                />
              )}
          </>
        )}
      </div>

      {/* Version History Drawer */}
      <Dialog
        open={versionsDrawerOpen}
        onClose={() => setVersionsDrawerOpen(false)}
        title={t.projects.versions}
      >
        <div className="space-y-3">
          {versions.map((ver) => {
            const isCurrent = ver.id === project?.currentVersionId;
            return (
              <div
                key={ver.id}
                className={`rounded-lg border p-3.5 flex items-center justify-between gap-3 ${
                  isCurrent
                    ? 'border-[var(--gold)] bg-[var(--surface-2)]'
                    : 'border-[var(--line)] bg-[var(--bg)]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold tabular-nums text-[var(--ink)]">
                      v{ver.versionNumber}
                    </span>
                    {isCurrent && (
                      <span className="text-[var(--gold-ink)] font-semibold">
                        ({t.projects.currentVersion})
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--ink)]">{ver.changeSummary}</p>
                </div>

                {!isCurrent && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleRestoreVersion(ver.id)}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.projects.restore}</span>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Dialog>

      <ToastNotice message={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 3. Public Read-Only Share View (/share/:token)
// ---------------------------------------------------------------------------

export function SharedProjectPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useI18n();
  const [result, setResult] = useState<WijahaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/shares/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('expired');
        const data = (await res.json()) as { result: WijahaResult };
        setResult(data.result);
      })
      .catch(() => setError(t.notFound.title));
  }, [token, t.notFound.title]);

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        {error && <ErrorBanner message={error} />}
        {result && (
          <>
            <DemoContentNotice text={t.result.demoRuleBadge} compact />
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">{result.title}</h1>
            <div className="space-y-5">
              {result.blocks.map((b, i) => (
                <ResultBlockRenderer key={i} block={b} blockIndex={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
