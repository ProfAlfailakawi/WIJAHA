import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Inbox,
  Play,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import {
  Button,
  EmptyState,
  Skeleton,
  ToastNotice,
} from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n } from '../lib/i18n';

type AdminTab =
  | 'overview'
  | 'content'
  | 'review'
  | 'scenarios'
  | 'requests'
  | 'evals'
  | 'analytics';

interface AdminOverviewPayload {
  stats: {
    totalRules: number;
    approvedRules: number;
    demoRules: number;
    inReviewRules: number;
    expiringWithin30Days: number;
    openServiceRequests: number;
    errorReports: number;
    completedResultsCount: number;
    estimatedAiCostKwd: number;
  };
  rules: Array<{
    id: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    level: string;
    sensitivity: string;
    status: string;
    countries: string[];
    topics: string[];
    reviewDueAt: string;
    reviewedBy?: string | null;
  }>;
  serviceRequests: Array<{
    id: string;
    requesterName: string;
    requesterEmail: string;
    serviceId: string;
    status: string;
    assignedOwner: string;
    quotedAmountKwd?: number | null;
    paid: boolean;
    clientNotes: string;
    internalNotes: string;
  }>;
  errorReports: Array<{
    id: string;
    resultId: string;
    comment?: string | null;
    ruleIds: string[];
  }>;
  evalRuns: Array<{
    id: string;
    providerUsed: string;
    totalCases: number;
    intentAccuracyPct: number;
    recallPct: number;
    schemaPassPct: number;
    highSensitivityPassPct: number;
    hallucinatedRulesCount: number;
    createdAt: string;
  }>;
  revenueSplitRules: Array<{
    id: string;
    ownerType: string;
    platformSharePct: number | null;
    yousefSharePct: number | null;
    ahmadSharePct: number | null;
    notes: string;
  }>;
  revenueLedger: Array<{
    id: string;
    sourceType: string;
    ownerType: string;
    grossAmountKwd: number;
    splitConfigured: boolean;
    platformAmountKwd: number | null;
    yousefAmountKwd: number | null;
    ahmadAmountKwd: number | null;
  }>;
}

export function AdminPage() {
  const { locale, t } = useI18n();
  const { state, openSignInModal, getBearerHeaders } = useAuth();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<AdminOverviewPayload | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Bilingual Rule Editor State
  const [ruleTitleAr, setRuleTitleAr] = useState('');
  const [ruleTitleEn, setRuleTitleEn] = useState('');
  const [ruleBodyAr, setRuleBodyAr] = useState('');
  const [ruleBodyEn, setRuleBodyEn] = useState('');
  const [ruleLevel, setRuleLevel] = useState('customary');
  const [ruleSensitivity, setRuleSensitivity] = useState('low');
  const [ruleCountries, setRuleCountries] = useState('KW,SA');
  const [savingRule, setSavingRule] = useState(false);
  const [detectedConflicts, setDetectedConflicts] = useState<
    Array<{ ruleId: string; titleAr: string; similarity: number }>
  >([]);

  // Evals Runner State
  const [runningEvals, setRunningEvals] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const res = await fetch('/api/admin/overview', {
        credentials: 'include',
        headers: getBearerHeaders(),
      });
      if (res.status === 403 || res.status === 401) {
        setForbidden(true);
        return;
      }
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [getBearerHeaders]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleSaveRule = async (submitForReview: boolean) => {
    if (!ruleTitleAr.trim() || !ruleTitleEn.trim()) return;
    setSavingRule(true);
    try {
      const res = await fetch('/api/admin/rules', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
        body: JSON.stringify({
          titleAr: ruleTitleAr,
          titleEn: ruleTitleEn,
          bodyAr: ruleBodyAr,
          bodyEn: ruleBodyEn,
          level: ruleLevel,
          sensitivity: ruleSensitivity,
          countries: ruleCountries.split(',').map((s) => s.trim().toUpperCase()),
          submitForReview,
        }),
      });
      if (res.ok) {
        const out = (await res.json()) as {
          id: string;
          conflicts: Array<{ ruleId: string; titleAr: string; similarity: number }>;
        };
        setDetectedConflicts(out.conflicts || []);
        setRuleTitleAr('');
        setRuleTitleEn('');
        setRuleBodyAr('');
        setRuleBodyEn('');
        await loadOverview();
        setToast(
          locale === 'ar'
            ? `تم حفظ القاعدة (${out.id}) بنجاح.`
            : `Saved rule (${out.id}) successfully.`,
        );
      }
    } finally {
      setSavingRule(false);
    }
  };

  const handleRuleStatus = async (ruleId: string, status: string) => {
    const res = await fetch(`/api/admin/rules/${encodeURIComponent(ruleId)}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await loadOverview();
      setToast(locale === 'ar' ? 'تم تحديث حالة القاعدة.' : 'Updated rule status.');
    } else if (res.status === 403) {
      setToast(
        locale === 'ar'
          ? 'القواعد عالية الحساسية تتطلب اعتماد «مراجع أول» (senior_reviewer).'
          : 'High-sensitivity rules require senior_reviewer approval.',
      );
    }
  };

  const handleUpdateRequestStatus = async (reqId: string, status: string) => {
    const res = await fetch(`/api/admin/requests/${encodeURIComponent(reqId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await loadOverview();
      setToast(locale === 'ar' ? 'تم تحديث حالة الطلب.' : 'Service request updated.');
    }
  };

  const handleRunEvals = async () => {
    setRunningEvals(true);
    try {
      const res = await fetch('/api/admin/evals/run', {
        method: 'POST',
        credentials: 'include',
        headers: getBearerHeaders(),
      });
      if (res.ok) {
        await loadOverview();
        setToast(
          locale === 'ar'
            ? 'اكتمل تشغيل مجموعة الاختبارات الذهبية (60 حالة).'
            : 'Completed 60-case golden evaluation suite.',
        );
      }
    } finally {
      setRunningEvals(false);
    }
  };

  const handleSaveSplit = async (
    ownerType: string,
    platformPct: string,
    yousefPct: string,
    ahmadPct: string,
  ) => {
    const res = await fetch('/api/admin/revenue-splits', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
      body: JSON.stringify({
        ownerType,
        platformSharePct: platformPct === '' ? null : Number(platformPct),
        yousefSharePct: yousefPct === '' ? null : Number(yousefPct),
        ahmadSharePct: ahmadPct === '' ? null : Number(ahmadPct),
      }),
    });
    if (res.ok) {
      await loadOverview();
      setToast(
        locale === 'ar' ? 'تم تحديث قواعد توزيع الإيراد.' : 'Revenue split rules updated.',
      );
    }
  };

  const tabItems: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: t.admin.tabs.overview, icon: ShieldCheck },
    { id: 'content', label: t.admin.tabs.content, icon: BookOpen },
    { id: 'review', label: t.admin.tabs.review, icon: ClipboardList },
    { id: 'requests', label: t.admin.tabs.requests, icon: Inbox },
    { id: 'evals', label: t.admin.tabs.evals, icon: FlaskConical },
    { id: 'analytics', label: t.admin.tabs.analytics, icon: BarChart3 },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">{t.admin.title}</h1>
            {state.actor && (
              <p className="text-xs text-[var(--gold-ink)] font-mono">
                {state.actor.email} · role={state.actor.platformRole}
              </p>
            )}
          </div>
        </header>

        {forbidden ? (
          <EmptyState
            icon={<ShieldAlert className="w-5 h-5" />}
            title={
              locale === 'ar'
                ? 'الوصول مقتصر على مسؤولي الحوكمة والمراجعين'
                : 'Restricted to Governance & Protocol Reviewers'
            }
            description={
              locale === 'ar'
                ? 'سجّل الدخول بحساب admin@wijaha.demo أو yousef@wijaha.demo لمعاينة لوحة الحوكمة.'
                : 'Sign in as admin@wijaha.demo or yousef@wijaha.demo to inspect the governance console.'
            }
            action={
              <Button variant="primary" onClick={() => openSignInModal(() => void loadOverview())}>
                {t.nav.signIn}
              </Button>
            }
          />
        ) : loading || !data ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-3">
              {tabItems.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--primary)] text-[var(--bg)]'
                        : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: OVERVIEW */}
            {tab === 'overview' && (
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4 tabular-nums">
                <KpiCard
                  label={locale === 'ar' ? 'إجمالي القواعد المعرفية' : 'Total Knowledge Rules'}
                  value={data.stats.totalRules}
                  sub={`${data.stats.demoRules} draft_demo`}
                />
                <KpiCard
                  label={locale === 'ar' ? 'بانتظار المراجعة' : 'Rules In Review'}
                  value={data.stats.inReviewRules}
                  sub={`${data.stats.expiringWithin30Days} due <30d`}
                />
                <KpiCard
                  label={locale === 'ar' ? 'طلبات خدمات مفتوحة' : 'Open Service Tickets'}
                  value={data.stats.openServiceRequests}
                  sub={`${data.stats.errorReports} error reports`}
                />
                <KpiCard
                  label={locale === 'ar' ? 'النتائج المولدة وتكلفة الذكاء' : 'Generated Results & Est. AI Cost'}
                  value={data.stats.completedResultsCount}
                  sub={`~${data.stats.estimatedAiCostKwd} KWD`}
                />
              </section>
            )}

            {/* TAB 2: BILINGUAL CONTENT EDITOR */}
            {tab === 'content' && (
              <div className="space-y-6">
                <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
                  <h2 className="text-base font-bold text-[var(--ink)]">
                    {locale === 'ar'
                      ? 'إضافة / تحرير قاعدة ثنائية اللغة (مع كشف التعارض الدلالي)'
                      : 'Bilingual Knowledge Rule Editor (with Semantic Conflict Check)'}
                  </h2>

                  {detectedConflicts.length > 0 && (
                    <div className="rounded-lg border border-[var(--warning)]/45 bg-[var(--surface-2)] p-3.5 text-xs space-y-1">
                      <p className="font-bold text-[var(--warning)] flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                          {locale === 'ar'
                            ? 'تنبيه تشابه دلالي مع قواعد قائمة:'
                            : 'Potential semantic overlap with existing rules:'}
                        </span>
                      </p>
                      {detectedConflicts.map((c) => (
                        <p key={c.ruleId} className="text-[var(--ink)]">
                          • {c.ruleId}: {c.titleAr} ({Math.round(c.similarity * 100)}%)
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={ruleTitleAr}
                        onChange={(e) => setRuleTitleAr(e.target.value)}
                        placeholder="العنوان بالعربية"
                        className="w-full min-h-[42px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm"
                      />
                      <textarea
                        rows={3}
                        value={ruleBodyAr}
                        onChange={(e) => setRuleBodyAr(e.target.value)}
                        placeholder="نص القاعدة البروتوكولية بالعربية…"
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-sm"
                      />
                    </div>
                    <div className="space-y-2" dir="ltr">
                      <input
                        type="text"
                        value={ruleTitleEn}
                        onChange={(e) => setRuleTitleEn(e.target.value)}
                        placeholder="English Rule Title"
                        className="w-full min-h-[42px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm"
                      />
                      <textarea
                        rows={3}
                        value={ruleBodyEn}
                        onChange={(e) => setRuleBodyEn(e.target.value)}
                        placeholder="English protocol rule statement…"
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={ruleLevel}
                      onChange={(e) => setRuleLevel(e.target.value)}
                      className="min-h-[40px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-xs"
                    >
                      <option value="official">official</option>
                      <option value="customary">customary</option>
                      <option value="advisory">advisory</option>
                    </select>
                    <select
                      value={ruleSensitivity}
                      onChange={(e) => setRuleSensitivity(e.target.value)}
                      className="min-h-[40px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-xs"
                    >
                      <option value="low">sensitivity: low</option>
                      <option value="medium">sensitivity: medium</option>
                      <option value="high">sensitivity: high</option>
                    </select>
                    <input
                      type="text"
                      value={ruleCountries}
                      onChange={(e) => setRuleCountries(e.target.value)}
                      dir="ltr"
                      placeholder="KW,SA,GLOBAL"
                      className="min-h-[40px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-xs font-mono"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      loading={savingRule}
                      onClick={() => void handleSaveRule(true)}
                    >
                      {locale === 'ar' ? 'حفظ وإرسال لطابور المراجعة' : 'Save & Submit to Review Queue'}
                    </Button>
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-2 max-h-[420px] overflow-y-auto">
                  {data.rules.slice(0, 20).map((r) => (
                    <div
                      key={r.id}
                      className="py-2.5 border-b border-[var(--line)] last:border-b-0 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-[var(--gold-ink)]" dir="ltr">
                          {r.id}
                        </span>{' '}
                        · <strong className="text-[var(--ink)]">{r.titleAr}</strong>
                      </div>
                      <span className="font-mono text-[var(--ink-3)]">
                        {r.level} · {r.sensitivity} · {r.status}
                      </span>
                    </div>
                  ))}
                </section>
              </div>
            )}

            {/* TAB 3: REVIEW QUEUE */}
            {tab === 'review' && (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
                <h2 className="text-base font-bold text-[var(--ink)]">{t.admin.tabs.review}</h2>
                {data.rules.slice(0, 12).map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1 max-w-xl">
                      <p className="text-xs font-mono text-[var(--gold-ink)]" dir="ltr">
                        {r.id} · sensitivity={r.sensitivity} · status={r.status}
                      </p>
                      <p className="text-sm font-semibold text-[var(--ink)]">{r.titleAr}</p>
                      <p className="text-xs text-[var(--ink-2)]">{r.bodyAr}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleRuleStatus(r.id, 'approved')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{locale === 'ar' ? 'اعتماد' : 'Approve'}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleRuleStatus(r.id, 'in_review')}
                      >
                        <span>in_review</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* TAB 4: CRM SERVICE REQUESTS */}
            {tab === 'requests' && (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
                <h2 className="text-base font-bold text-[var(--ink)]">{t.admin.tabs.requests}</h2>
                {data.serviceRequests.length === 0 ? (
                  <p className="text-sm text-[var(--ink-3)]">
                    {locale === 'ar' ? 'لا توجد طلبات استشارية بعد.' : 'No service requests yet.'}
                  </p>
                ) : (
                  data.serviceRequests.map((sr) => (
                    <div
                      key={sr.id}
                      className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-mono font-bold text-[var(--gold-ink)]" dir="ltr">
                          {sr.id} · {sr.serviceId} · owner={sr.assignedOwner}
                        </p>
                        <p className="text-sm font-semibold text-[var(--ink)]">
                          {sr.requesterName} ({sr.requesterEmail})
                        </p>
                        <p className="text-xs text-[var(--ink-2)]">{sr.clientNotes}</p>
                      </div>
                      <select
                        value={sr.status}
                        onChange={(e) => void handleUpdateRequestStatus(sr.id, e.target.value)}
                        className="min-h-[38px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-mono"
                      >
                        <option value="new">new</option>
                        <option value="awaiting_quote">awaiting_quote</option>
                        <option value="in_progress">in_progress</option>
                        <option value="delivered">delivered</option>
                        <option value="closed">closed</option>
                      </select>
                    </div>
                  ))
                )}
              </section>
            )}

            {/* TAB 5: GOLDEN EVALS RUNNER */}
            {tab === 'evals' && (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-[var(--ink)]">
                      {locale === 'ar'
                        ? 'مجموعة الاختبارات الذهبية (60 حالة منها 20 باللهجة الخليجية)'
                        : 'Golden Evaluation Suite (60 Cases incl. 20 Gulf Dialect)'}
                    </h2>
                    <p className="text-xs text-[var(--ink-2)]">
                      {locale === 'ar'
                        ? 'بوابات القبول: دقة النية ≥85%، الاسترجاع ≥80%، صحة المخطط ≥98%، صفر قواعد مختلقة.'
                        : 'Hard gates: Intent ≥85%, Recall ≥80%, Schema ≥98%, 0 hallucinated rules.'}
                    </p>
                  </div>
                  <Button variant="primary" loading={runningEvals} onClick={() => void handleRunEvals()}>
                    <Play className="w-4 h-4" />
                    <span>{locale === 'ar' ? 'تشغيل 60 اختباراً الآن' : 'Run 60 Evals Now'}</span>
                  </Button>
                </div>

                {data.evalRuns.map((er) => (
                  <div
                    key={er.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center tabular-nums"
                  >
                    <div>
                      <p className="text-lg font-bold text-[var(--success)]">
                        {er.intentAccuracyPct}%
                      </p>
                      <p className="text-[11px] text-[var(--ink-3)]">Intent (≥85%)</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[var(--success)]">{er.recallPct}%</p>
                      <p className="text-[11px] text-[var(--ink-3)]">Recall@10 (≥80%)</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[var(--success)]">{er.schemaPassPct}%</p>
                      <p className="text-[11px] text-[var(--ink-3)]">Schema (≥98%)</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[var(--success)]">
                        {er.highSensitivityPassPct}%
                      </p>
                      <p className="text-[11px] text-[var(--ink-3)]">High-Sens (100%)</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[var(--ink)]">
                        {er.hallucinatedRulesCount}
                      </p>
                      <p className="text-[11px] text-[var(--ink-3)]">Hallucinated IDs</p>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* TAB 6: CONFIGURABLE REVENUE SPLITS & LEDGER */}
            {tab === 'analytics' && (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-[var(--ink)]">
                    {locale === 'ar'
                      ? 'قواعد توزيع الإيراد القابلة للضبط (بدون نسب افتراضية مفترضة)'
                      : 'Configurable Revenue Split Rules (Null Defaults Until Agreed)'}
                  </h2>
                  <p className="text-xs text-[var(--ink-2)]">
                    {locale === 'ar'
                      ? 'تُحفظ الإيرادات في السجل المحاسبي غير الموزع حتى يضبط مدير المنصة النسب التعاقدية رسمياً.'
                      : 'Transactions record as unallocated in the ledger until Platform Admin enters agreed split percentages.'}
                  </p>
                </div>

                <div className="space-y-3">
                  {data.revenueSplitRules.map((rule) => (
                    <RevenueSplitRowEditor
                      key={rule.id}
                      rule={rule}
                      onSave={handleSaveSplit}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <ToastNotice message={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-1">
      <p className="text-xs text-[var(--ink-2)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--ink)] tabular-nums">{value}</p>
      <p className="text-[11px] font-mono text-[var(--gold-ink)]">{sub}</p>
    </div>
  );
}

function RevenueSplitRowEditor({
  rule,
  onSave,
}: {
  rule: AdminOverviewPayload['revenueSplitRules'][number];
  onSave: (o: string, p: string, y: string, a: string) => Promise<void>;
}) {
  const [p, setP] = useState(rule.platformSharePct === null ? '' : String(rule.platformSharePct));
  const [y, setY] = useState(rule.yousefSharePct === null ? '' : String(rule.yousefSharePct));
  const [a, setA] = useState(rule.ahmadSharePct === null ? '' : String(rule.ahmadSharePct));

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="font-mono font-bold text-[var(--ink)] min-w-[110px]">
        {rule.ownerType}
      </span>
      <div className="flex flex-wrap items-center gap-2" dir="ltr">
        <input
          type="number"
          placeholder="Platform %"
          value={p}
          onChange={(e) => setP(e.target.value)}
          className="w-28 min-h-[36px] rounded border border-[var(--line)] bg-[var(--surface)] px-2 tabular-nums"
        />
        <input
          type="number"
          placeholder="Yousef %"
          value={y}
          onChange={(e) => setY(e.target.value)}
          className="w-28 min-h-[36px] rounded border border-[var(--line)] bg-[var(--surface)] px-2 tabular-nums"
        />
        <input
          type="number"
          placeholder="Ahmad %"
          value={a}
          onChange={(e) => setA(e.target.value)}
          className="w-28 min-h-[36px] rounded border border-[var(--line)] bg-[var(--surface)] px-2 tabular-nums"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void onSave(rule.ownerType, p, y, a)}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
