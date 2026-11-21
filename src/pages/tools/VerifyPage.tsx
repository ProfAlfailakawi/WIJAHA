import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, ShieldX } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { useI18n } from '../../lib/i18n';
import { btnPrimary, card, input, Page, ToolHero } from './ui';

interface Verified {
  valid: boolean;
  name?: string;
  correct?: number;
  total?: number;
  issuedOn?: string;
}

export function VerifyPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const { code } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState<Verified | 'loading' | 'error' | null>(code ? 'loading' : null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!code) return;
    let alive = true;
    setState('loading');
    fetch(`/api/certificate/verify?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((v: Verified) => alive && setState(v))
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [code]);

  return (
    <AppShell>
      <Page>
        <ToolHero icon={<BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />} kicker={ar ? 'التحقق' : 'Verification'} title={ar ? 'التحقق من شهادة وجاهة' : 'Verify a WIJAHA certificate'} sub={ar ? 'يتحقق الخادم من توقيع الرمز فلا يمكن تزويره أو تعديل الاسم أو الدرجة.' : 'The server checks the code’s signature, so the name or score cannot be forged or edited.'} />
        <section className={`${card} space-y-4`} aria-live="polite">
          {state === 'loading' && <p className="text-[var(--ink-2)]">{ar ? 'جارٍ التحقق…' : 'Verifying…'}</p>}
          {state === 'error' && <p role="alert" className="text-[var(--c-rose)] font-semibold">{ar ? 'تعذّر الاتصال بالخادم.' : 'Could not reach the server.'}</p>}
          {state && typeof state === 'object' && state.valid && (
            <div data-testid="verify-valid" className="space-y-1">
              <p className="flex items-center gap-2 text-xl font-bold text-[var(--c-teal)]"><BadgeCheck className="w-6 h-6" aria-hidden="true" />{ar ? 'الشهادة صحيحة' : 'Valid certificate'}</p>
              <p className="text-[var(--ink)]">{ar ? 'الاسم' : 'Name'}: <strong>{state.name}</strong></p>
              <p className="text-[var(--ink)]">{ar ? 'الدرجة' : 'Score'}: <strong>{state.correct}/{state.total}</strong></p>
              <p className="text-[var(--ink)]">{ar ? 'تاريخ الإصدار' : 'Issued'}: <strong dir="ltr">{state.issuedOn}</strong></p>
            </div>
          )}
          {state && typeof state === 'object' && !state.valid && (
            <p className="flex items-center gap-2 text-xl font-bold text-[var(--c-rose)]" data-testid="verify-invalid"><ShieldX className="w-6 h-6" aria-hidden="true" />{ar ? 'رمز غير صالح' : 'Invalid code'}</p>
          )}
          <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) nav(`/verify/${encodeURIComponent(typed.trim())}`); }} className="flex flex-wrap gap-2">
            <label className="flex-1 min-w-[220px] text-sm font-semibold text-[var(--ink)]">
              {ar ? 'رمز الشهادة' : 'Certificate code'}
              <input className={`${input} mt-1`} value={typed} onChange={(e) => setTyped(e.target.value)} dir="ltr" data-testid="verify-input" />
            </label>
            <button type="submit" className={`${btnPrimary} self-end`}>{ar ? 'تحقق' : 'Verify'}</button>
          </form>
        </section>
      </Page>
    </AppShell>
  );
}
