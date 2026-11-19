import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, ClipboardCheck, Sparkles } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button, DemoContentNotice } from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n } from '../lib/i18n';
import type { PlanCheckResponse } from '../shared/types';

export function CheckPlanPage() {
  const { locale, t } = useI18n();
  const { getBearerHeaders } = useAuth();

  const [planText, setPlanText] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PlanCheckResponse | null>(null);

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planText.trim().length < 10) return;
    setLoading(true);
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
        body: JSON.stringify({ planText, contextNote, locale }),
      });
      if (res.ok) {
        const data = (await res.json()) as { report: PlanCheckResponse };
        setReport(data.report);
      }
    } finally {
      setLoading(false);
    }
  };

  const counts = {
    critical: report?.findings.filter((f) => f.severity === 'critical').length ?? 0,
    important: report?.findings.filter((f) => f.severity === 'important').length ?? 0,
    improvement: report?.findings.filter((f) => f.severity === 'improvement').length ?? 0,
  };

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <header className="space-y-2">
          <DemoContentNotice text={t.result.demoRuleBadge} compact />
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">{t.check.title}</h1>
          <p className="text-sm sm:text-base text-[var(--ink-2)] leading-relaxed">
            {t.check.subtitle}
          </p>
        </header>

        <form
          onSubmit={(e) => void handleAudit(e)}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4"
        >
          <div className="space-y-2">
            <label htmlFor="check-plan-text" className="block text-sm font-semibold text-[var(--ink)]">
              {t.check.planLabel}
            </label>
            <textarea
              id="check-plan-text"
              rows={6}
              required
              minLength={10}
              value={planText}
              onChange={(e) => setPlanText(e.target.value)}
              placeholder={t.check.planPlaceholder}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--ink)] leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="check-context-note" className="block text-xs font-medium text-[var(--ink-2)]">
              {t.check.contextLabel}
            </label>
            <input
              id="check-context-note"
              type="text"
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              placeholder={locale === 'ar' ? 'مثال: زيارة وزارية رسمية في الكويت' : 'e.g., Official ministerial visit in Kuwait'}
              className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() =>
                setPlanText(
                  locale === 'ar'
                    ? 'الساعة 10:00 وصول معالي الوزير الضيف إلى البوابة، الساعة 10:05 توقيع الاتفاقية مباشرة دون استراحة، ثم تقديم هدية للضيف أمام الكاميرات.'
                    : '10:00 Guest Minister arrives at gate; 10:05 immediate MoU signing without holding room break, followed by public gift opening in front of press.',
                )
              }
              className="text-xs text-[var(--gold-ink)] font-medium underline underline-offset-4 cursor-pointer"
            >
              {locale === 'ar' ? 'تجربة نص برنامج جاهز للمعاينة' : 'Fill sample visit itinerary'}
            </button>

            <Button type="submit" variant="primary" loading={loading}>
              <ClipboardCheck className="w-4 h-4" />
              <span>{t.check.submitBtn}</span>
            </Button>
          </div>
        </form>

        {report && (
          <section className="space-y-5">
            {/* Severity Infographic Strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-center">
                <p className="text-2xl font-bold tabular-nums text-[var(--danger)]">
                  {counts.critical}
                </p>
                <p className="text-xs text-[var(--ink-2)] mt-1">{t.check.severities.critical}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-center">
                <p className="text-2xl font-bold tabular-nums text-[var(--warning)]">
                  {counts.important}
                </p>
                <p className="text-xs text-[var(--ink-2)] mt-1">{t.check.severities.important}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-center">
                <p className="text-2xl font-bold tabular-nums text-[var(--success)]">
                  {counts.improvement}
                </p>
                <p className="text-xs text-[var(--ink-2)] mt-1">{t.check.severities.improvement}</p>
              </div>
            </div>

            <p className="text-sm font-medium text-[var(--ink)]">{report.summary}</p>

            <div className="space-y-4">
              {report.findings.map((f) => {
                const Icon =
                  f.severity === 'critical'
                    ? AlertOctagon
                    : f.severity === 'important'
                      ? AlertTriangle
                      : Sparkles;
                const tone =
                  f.severity === 'critical'
                    ? 'text-[var(--danger)]'
                    : f.severity === 'important'
                      ? 'text-[var(--warning)]'
                      : 'text-[var(--gold-ink)]';

                return (
                  <article
                    key={f.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={`inline-flex items-center gap-2 text-xs font-bold ${tone}`}>
                        <Icon className="w-4 h-4" aria-hidden="true" />
                        <span>{t.check.severities[f.severity]}</span>
                      </div>
                      {f.ruleId && (
                        <span className="text-xs font-mono text-[var(--ink-3)]" dir="ltr">
                          {f.ruleId}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-[var(--ink)]">{f.what}</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-1">
                      <div className="rounded-lg bg-[var(--surface-2)] p-3.5 space-y-1">
                        <p className="text-xs font-semibold text-[var(--ink-3)]">
                          {t.check.whyLabel}
                        </p>
                        <p className="text-[var(--ink)] leading-relaxed">{f.why}</p>
                      </div>
                      <div className="rounded-lg bg-[var(--bg)] border border-[var(--line)] p-3.5 space-y-1">
                        <p className="text-xs font-semibold text-[var(--gold-ink)] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
                          <span>{t.check.suggestionLabel}</span>
                        </p>
                        <p className="text-[var(--ink)] leading-relaxed">{f.suggestion}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
