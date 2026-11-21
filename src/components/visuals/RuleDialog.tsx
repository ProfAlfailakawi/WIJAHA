import React, { useEffect, useState } from 'react';
import { Dialog } from '../ui/Primitives';
import { tr } from './svg-kit.tsx';

interface RuleData {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  level: string;
  exceptions?: string | null;
  reviewedBy?: string | null;
  references: Array<{ title: string; publisher?: string; url?: string | null }>;
}

/** Shows one knowledge rule (title, body, references) fetched from the public read-only endpoint. */
export function RuleDialog({ ruleId, locale, onClose }: { ruleId: string | null; locale: string; onClose: () => void }) {
  const [rule, setRule] = useState<RuleData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ruleId) return;
    let alive = true;
    setRule(null);
    setError(false);
    fetch(`/api/rules/${encodeURIComponent(ruleId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { rule: RuleData }) => alive && setRule(d.rule))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [ruleId]);

  return (
    <Dialog
      open={Boolean(ruleId)}
      onClose={onClose}
      title={rule ? tr(locale, rule.titleAr, rule.titleEn) : ruleId ?? ''}
      subtitle={ruleId ?? undefined}
    >
      {error && <p className="text-sm text-[var(--ink-2)]">{tr(locale, 'تعذّر تحميل القاعدة.', 'The rule could not be loaded.')}</p>}
      {!rule && !error && <p className="text-sm text-[var(--ink-3)]">{tr(locale, 'جارٍ التحميل…', 'Loading…')}</p>}
      {rule && (
        <div className="space-y-3 text-sm">
          <p className="leading-relaxed text-[var(--ink)]">{tr(locale, rule.bodyAr, rule.bodyEn)}</p>
          {rule.exceptions && <p className="text-xs text-[var(--ink-3)] leading-relaxed">{rule.exceptions}</p>}
          {rule.reviewedBy && (
            <p className="text-xs text-[var(--ink-2)]">
              {tr(locale, 'اعتماد:', 'Approved by:')} {rule.reviewedBy}
            </p>
          )}
          {rule.references.length > 0 && (
            <ul className="space-y-1 border-t border-[var(--line)] pt-3">
              {rule.references.map((ref, i) => (
                <li key={i} className="text-xs text-[var(--ink-2)] leading-relaxed">
                  {ref.url ? (
                    <a href={ref.url} target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--gold)] underline-offset-2 hover:text-[var(--ink)]">
                      {ref.title}
                    </a>
                  ) : (
                    ref.title
                  )}
                  {ref.publisher ? <span className="text-[var(--ink-3)]"> — {ref.publisher}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}
