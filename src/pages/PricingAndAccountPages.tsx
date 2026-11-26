import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  Check,
  CreditCard,
  Download,
  LogOut,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import {
  Button,
  EmptyState,
  Skeleton,
  ToastNotice,
} from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n, type ThemeMode } from '../lib/i18n';
import { commerceVisible, followCheckoutUrl } from '../lib/appleNativeShell';
import type { Locale } from '../shared/types';

interface PlanItem {
  id: string;
  nameAr: string;
  nameEn: string;
  audienceAr: string;
  audienceEn: string;
  monthlyPriceKwd: number | null;
  annualPriceKwd: number | null;
  isQuote: boolean;
  entitlements: Record<string, string>;
}

interface ServiceItem {
  id: string;
  titleAr: string;
  titleEn: string;
  turnaroundAr: string;
  turnaroundEn: string;
  pricingType: string;
  priceAmountKwd: number | null;
}

// ---------------------------------------------------------------------------
// 1. Pricing & Subscriptions Page (/pricing)
// ---------------------------------------------------------------------------

export function PricingPage() {
  const { locale, t } = useI18n();
  const { state, openSignInModal, getBearerHeaders, refreshAuth } = useAuth();
  const navigate = useNavigate();

  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/plans')
      .then((r) => r.json())
      .then((d: { plans: PlanItem[]; services: ServiceItem[] }) => {
        setPlans(d.plans || []);
        setServices(d.services || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (plan: PlanItem) => {
    if (plan.isQuote) {
      navigate('/request/SRV-JOINT-ACADEMY');
      return;
    }
    if (!state.authenticated) {
      openSignInModal(() => void handleSubscribe(plan));
      return;
    }
    setCheckingOutId(plan.id);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
        body: JSON.stringify({ planId: plan.id, billingCycle: cycle }),
      });
      if (!res.ok) {
        setToast(res.status === 403 ? t.errors.forbidden : t.errors.serverError);
        return;
      }
      const data = (await res.json()) as {
        sessionId?: string;
        checkoutUrl?: string;
        provider?: 'mock' | 'stripe';
      };

      if (data.provider === 'mock' && data.sessionId) {
        const completeRes = await fetch('/api/billing/dev-mock-complete', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
          body: JSON.stringify({ sessionId: data.sessionId }),
        });
        if (completeRes.ok) {
          await refreshAuth();
          setToast(
            locale === 'ar'
              ? `تم تفعيل باقة «${plan.nameAr}» وإصدار الفاتورة.`
              : `Activated ${plan.nameEn} plan and issued invoice.`,
          );
        } else {
          setToast(t.errors.serverError);
        }
      } else if (followCheckoutUrl(data.checkoutUrl)) {
        window.location.assign(data.checkoutUrl as string);
      }
    } finally {
      setCheckingOutId(null);
    }
  };

  const activePlanId = state.entitlements?.planId || 'free';

  // داخل تطبيق iOS: لا أسعار ولا اشتراك ولا دفع (3.1.1). تظهر الباقة الحالية وطريق مجاني للمتابعة.
  if (!commerceVisible()) {
    return (
      <AppShell>
        <div className="max-w-xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6 text-center" data-testid="native-plan-notice">
          <h1 className="text-2xl font-bold text-[var(--ink)]">
            {locale === 'ar' ? 'باقتك في وجاهة' : 'Your WIJAHA plan'}
          </h1>
          {state.authenticated && (
            <p className="text-sm text-[var(--ink-2)]">
              {locale === 'ar' ? 'الباقة الحالية:' : 'Current plan:'}{' '}
              <span className="font-semibold text-[var(--ink)]">{activePlanId.toUpperCase()}</span>
            </p>
          )}
          <p className="text-sm text-[var(--ink-2)] leading-relaxed">
            {locale === 'ar'
              ? 'الأدوات والتدريب والمخططات متاحة لك في التطبيق ضمن حدود باقتك.'
              : 'Tools, practice and planners are available in the app within your plan.'}
          </p>
          <Button variant="primary" onClick={() => navigate('/tools')}>
            {t.nav.tools}
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-12">
        <header className="text-center max-w-2xl mx-auto space-y-4">
          <h1 className="text-2xl sm:text-4xl font-bold text-[var(--ink)]">{t.pricing.title}</h1>
          <p className="text-sm sm:text-base text-[var(--ink-2)]">{t.pricing.subtitle}</p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              className={`min-h-[38px] px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                cycle === 'monthly'
                  ? 'bg-[var(--primary)] text-[var(--bg)]'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              {t.pricing.monthly}
            </button>
            <button
              type="button"
              onClick={() => setCycle('annual')}
              className={`min-h-[38px] px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                cycle === 'annual'
                  ? 'bg-[var(--primary)] text-[var(--bg)]'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              {t.pricing.annual}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {plans.map((p) => {
              const isCurrent = state.authenticated && activePlanId === p.id;
              const price = cycle === 'annual' ? p.annualPriceKwd : p.monthlyPriceKwd;

              return (
                <article
                  key={p.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between gap-6 ${
                    p.id === 'team'
                      ? 'border-[var(--gold)] bg-[var(--surface)] shadow-xs'
                      : 'border-[var(--line)] bg-[var(--surface)]'
                  }`}
                >
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--ink)]">
                        {locale === 'ar' ? p.nameAr : p.nameEn}
                      </h2>
                      <p className="text-xs text-[var(--ink-2)] mt-1 leading-relaxed">
                        {locale === 'ar' ? p.audienceAr : p.audienceEn}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--line)]">
                      {p.isQuote ? (
                        <p className="text-xl font-bold text-[var(--ink)]">{t.pricing.quote}</p>
                      ) : (
                        <p className="text-2xl font-bold text-[var(--ink)] tabular-nums">
                          {price ?? 0}{' '}
                          <span className="text-xs font-normal text-[var(--ink-3)]">
                            {cycle === 'annual' ? t.pricing.perYear : t.pricing.perMonth}
                          </span>
                        </p>
                      )}
                    </div>

                    <ul className="space-y-2 text-xs text-[var(--ink)] tabular-nums">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                        <span>
                          {p.entitlements.results_per_month}{' '}
                          {locale === 'ar' ? 'نتيجة / شهر' : 'results / mo'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                        <span>
                          {p.entitlements.projects_max}{' '}
                          {locale === 'ar' ? 'مشروع محفوظ' : 'saved projects'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                        <span>
                          {p.entitlements.seats} {locale === 'ar' ? 'مقاعد مستخدمين' : 'seats'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                        <span>
                          {p.entitlements.watermark === 'true'
                            ? locale === 'ar'
                              ? 'تصدير بعلامة وجاهة'
                              : 'Watermarked export'
                            : locale === 'ar'
                              ? 'تصدير رسمي بلا علامة مائية'
                              : 'Clean unwatermarked export'}
                        </span>
                      </li>
                    </ul>

                    <p className="text-[11px] text-[var(--ink-3)] pt-2 border-t border-[var(--line)]">
                      <strong>{t.pricing.excludedLabel}</strong>{' '}
                      {locale === 'ar'
                        ? 'مراجعة الخبراء والتدريب الحضوري (تُطلب منفصلة).'
                        : 'Human expert review & live workshops (billed separately).'}
                    </p>
                  </div>

                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isCurrent}
                    loading={checkingOutId === p.id}
                    onClick={() => void handleSubscribe(p)}
                    className="w-full"
                  >
                    {isCurrent ? t.pricing.currentPlan : t.pricing.choosePlan}
                  </Button>
                </article>
              );
            })}
          </section>
        )}

        {/* Separate Expert Services Table (Section 17.1) */}
        {services.length > 0 && (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[var(--ink)]">{t.experts.title}</h2>
              <Link to="/experts" className="text-xs font-semibold text-[var(--gold-ink)] underline">
                {t.experts.viewProfile}
              </Link>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[var(--ink)]">
                      {locale === 'ar' ? s.titleAr : s.titleEn}
                    </p>
                    <p className="text-xs text-[var(--ink-3)]">
                      {locale === 'ar' ? s.turnaroundAr : s.turnaroundEn}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[var(--gold-ink)] tabular-nums">
                      {s.pricingType === 'fixed' && s.priceAmountKwd
                        ? `${s.priceAmountKwd} KWD`
                        : t.pricing.quote}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/request/${s.id}`)}
                    >
                      {t.experts.requestService}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3 Mandatory Transparent FAQs */}
        <section className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-xl font-bold text-[var(--ink)] text-center">{t.pricing.faqTitle}</h2>
          <div className="space-y-3">
            {t.pricing.faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-1.5"
              >
                <h3 className="text-sm font-bold text-[var(--ink)]">{faq.q}</h3>
                <p className="text-sm text-[var(--ink-2)] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <ToastNotice message={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 2. Account Settings, Usage, Invoices & Privacy Controls (/account)
// ---------------------------------------------------------------------------

interface InvoiceRow {
  id: string;
  description: string;
  amountKwd: number;
  status: string;
  issuedAt: string;
}

export function AccountPage() {
  const { locale, setLocale, theme, setTheme, t } = useI18n();
  const { state, openSignInModal, signOut, getBearerHeaders, refreshAuth } = useAuth();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [expertEnabled, setExpertEnabled] = useState<boolean>(
    state.preferences?.expertSuggestionsEnabled ?? true,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (state.preferences) {
      setExpertEnabled(state.preferences.expertSuggestionsEnabled);
    }
  }, [state.preferences]);

  useEffect(() => {
    if (!state.authenticated) return;
    fetch('/api/billing/invoices', {
      credentials: 'include',
      headers: getBearerHeaders(),
    })
      .then((r) => r.json())
      .then((d: { invoices: InvoiceRow[] }) => setInvoices(d.invoices || []))
      .catch(() => undefined);
  }, [state.authenticated, getBearerHeaders]);

  const updatePreference = async (patch: {
    locale?: Locale;
    theme?: ThemeMode;
    expertSuggestionsEnabled?: boolean;
  }) => {
    if (patch.locale) setLocale(patch.locale);
    if (patch.theme) setTheme(patch.theme);
    if (typeof patch.expertSuggestionsEnabled === 'boolean') {
      setExpertEnabled(patch.expertSuggestionsEnabled);
    }
    if (state.authenticated) {
      await fetch('/api/account', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
        body: JSON.stringify(patch),
      });
      await refreshAuth();
    }
  };

  const handleCancelSubscription = async () => {
    const res = await fetch('/api/billing/cancel', {
      method: 'POST',
      credentials: 'include',
      headers: getBearerHeaders(),
    });
    if (res.ok) {
      await refreshAuth();
      setToast(
        locale === 'ar'
          ? 'تم إلغاء تجديد الاشتراك بنقرتين بنجاح.'
          : 'Subscription renewal cancelled in 2 clicks.',
      );
    }
  };

  const handleScheduleDelete = async () => {
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      credentials: 'include',
      headers: getBearerHeaders(),
    });
    if (res.ok) {
      await signOut();
      navigate('/');
    }
  };

  const used = state.usage?.resultsUsed ?? 0;
  const limit = state.usage?.resultsLimit ?? 15;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  return (
    <AppShell>
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">{t.account.title}</h1>
          {state.authenticated && (
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="w-4 h-4" />
              <span>{t.nav.signOut}</span>
            </Button>
          )}
        </div>

        {!state.authenticated ? (
          <EmptyState
            title={t.auth.dialogTitle}
            description={t.auth.dialogSubtitle}
            action={
              <Button variant="primary" onClick={() => openSignInModal()}>
                {t.nav.signIn}
              </Button>
            }
          />
        ) : (
          <>
            {/* Profile & Org Quick Link */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-base font-bold text-[var(--ink)]">{state.actor?.name}</p>
                <p className="text-xs text-[var(--ink-3)]" dir="ltr">
                  {state.actor?.email}
                </p>
              </div>
              <Link to="/org">
                <Button variant="secondary" size="sm">
                  <Building2 className="w-4 h-4" />
                  <span>{t.nav.organization}</span>
                </Button>
              </Link>
            </section>

            {/* Preferences: Language, Theme, Expert Toggle */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--ink)]">{t.account.language}</span>
                <div className="inline-flex rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surface-2)]">
                  {(['ar', 'en'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => void updatePreference({ locale: l })}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                        locale === l
                          ? 'bg-[var(--surface)] text-[var(--ink)]'
                          : 'text-[var(--ink-2)]'
                      }`}
                    >
                      {l === 'ar' ? 'العربية' : 'English'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--ink)]">{t.account.theme}</span>
                <div className="inline-flex rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surface-2)]">
                  {(['light', 'dark', 'system'] as const).map((th) => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => void updatePreference({ theme: th })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                        theme === th
                          ? 'bg-[var(--surface)] text-[var(--ink)]'
                          : 'text-[var(--ink-2)]'
                      }`}
                    >
                      {t.account.themes[th]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--line)] cursor-pointer">
                <span className="text-sm text-[var(--ink)]">{t.account.expertToggle}</span>
                <input
                  type="checkbox"
                  checked={expertEnabled}
                  onChange={(e) =>
                    void updatePreference({ expertSuggestionsEnabled: e.target.checked })
                  }
                  className="w-4 h-4"
                />
              </label>
            </section>

            {/* Monthly Usage Meter & Subscription Control */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[var(--ink)]">{t.account.usageTitle}</span>
                <span className="font-mono tabular-nums text-xs text-[var(--gold-ink)]">
                  {state.entitlements?.planId.toUpperCase()} · {used} / {limit}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--primary)] rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {commerceVisible() && (
                  <Link to="/pricing">
                    <Button variant="secondary" size="sm">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{t.nav.pricing}</span>
                    </Button>
                  </Link>
                )}
                {state.entitlements?.planId !== 'free' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCancelSubscription()}
                  >
                    {t.account.cancelSub}
                  </Button>
                )}
              </div>
            </section>

            {/* Invoices (web only: amounts are prices) */}
            {commerceVisible() && (
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--ink)]">{t.account.invoicesTitle}</h2>
              {invoices.length === 0 ? (
                <p className="text-xs text-[var(--ink-3)]">
                  {locale === 'ar' ? 'لا توجد فواتير مسجلة بعد.' : 'No invoices issued yet.'}
                </p>
              ) : (
                <div className="divide-y divide-[var(--line)] text-xs">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--ink)]">{inv.description}</p>
                        <p className="text-[var(--ink-3)] font-mono" dir="ltr">
                          {inv.id}
                        </p>
                      </div>
                      <span className="font-bold tabular-nums text-[var(--ink)]">
                        {inv.amountKwd} KWD
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            )}

            {/* Data Portability & 14-Day Soft Delete (Section 21.5) */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-wrap items-center justify-between gap-3">
              <a href="/api/account/export" download>
                <Button variant="secondary" size="sm">
                  <Download className="w-4 h-4" />
                  <span>{t.account.exportData}</span>
                </Button>
              </a>

              {!confirmDelete ? (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-4 h-4 text-[var(--danger)]" />
                  <span className="text-[var(--danger)]">{t.account.deleteAccount}</span>
                </Button>
              ) : (
                <Button variant="danger" size="sm" onClick={() => void handleScheduleDelete()}>
                  {t.account.deleteConfirm}
                </Button>
              )}
            </section>
          </>
        )}
      </div>
      <ToastNotice message={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 3. Organization & Team Management (/org)
// ---------------------------------------------------------------------------

export function OrgPage() {
  const { locale, t } = useI18n();
  const { state, openSignInModal, getBearerHeaders } = useAuth();

  const [orgData, setOrgData] = useState<{
    org: { id: string; name: string; planId: string } | null;
    members: Array<{ id: number; userUid: string; role: string; email: string; name: string }>;
    invitations: Array<{ id: string; email: string; role: string }>;
    seatsLimit: number;
  } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadOrg = useCallback(async () => {
    if (!state.authenticated) return;
    const res = await fetch('/api/org', {
      credentials: 'include',
      headers: getBearerHeaders(),
    });
    if (res.ok) {
      setOrgData(await res.json());
    }
  }, [getBearerHeaders, state.authenticated]);

  useEffect(() => {
    void loadOrg();
  }, [loadOrg]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch('/api/org/invitations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        const data = (await res.json()) as { inviteUrl?: string };
        setInviteEmail('');
        if (data.inviteUrl) {
          await navigator.clipboard.writeText(data.inviteUrl).catch(() => undefined);
        }
        await loadOrg();
        setToast(
          locale === 'ar'
            ? 'تم إنشاء الدعوة ونسخ رابط القبول لمرة واحدة.'
            : 'Invitation created and one-time accept link copied.',
        );
      } else {
        setToast(
          locale === 'ar'
            ? 'تحقق من صلاحية الإدارة أو سعة المقاعد في باقتك.'
            : 'Check admin permissions or seat capacity on your plan.',
        );
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (targetUid: string) => {
    const res = await fetch(`/api/org/members/${encodeURIComponent(targetUid)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getBearerHeaders(),
    });
    if (res.ok) {
      await loadOrg();
      setToast(locale === 'ar' ? 'تمت إزالة العضو وإبطال جلسته.' : 'Member removed and session revoked.');
    } else {
      setToast(t.errors.forbidden);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">{t.org.title}</h1>

        {!state.authenticated ? (
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title={t.auth.dialogTitle}
            action={
              <Button variant="primary" onClick={() => openSignInModal()}>
                {t.nav.signIn}
              </Button>
            }
          />
        ) : orgData ? (
          <>
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--ink)]">{orgData.org?.name}</h2>
                <p className="text-xs text-[var(--gold-ink)] uppercase font-semibold">
                  {orgData.org?.planId}
                </p>
              </div>
              <div className="text-sm tabular-nums text-[var(--ink-2)]">
                {t.org.seatsUsed}:{' '}
                <strong className="text-[var(--ink)]">
                  {orgData.members.length} / {orgData.seatsLimit}
                </strong>
              </div>
            </section>

            <form
              onSubmit={(e) => void handleInvite(e)}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3"
            >
              <h3 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[var(--gold-ink)]" />
                <span>{t.org.inviteTitle}</span>
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@organization.org"
                  className="flex-1 min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
                >
                  <option value="member">member</option>
                  <option value="org_admin">org_admin</option>
                  <option value="viewer">viewer</option>
                </select>
                <Button type="submit" variant="primary" loading={inviting}>
                  {t.org.inviteBtn}
                </Button>
              </div>
            </form>

            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--ink)]">{t.org.membersTitle}</h3>
              <div className="divide-y divide-[var(--line)] text-sm">
                {orgData.members.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--ink)]">{m.name}</p>
                      <p className="text-xs text-[var(--ink-3)]" dir="ltr">
                        {m.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2.5 py-1 rounded bg-[var(--surface-2)] text-[var(--ink-2)]">
                        {m.role}
                      </span>
                      {m.userUid !== state.actor?.uid &&
                        (state.actor?.orgRole === 'org_owner' ||
                          (state.actor?.orgRole === 'org_admin' && m.role !== 'org_owner')) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={
                              locale === 'ar'
                                ? `إزالة ${m.name}`
                                : `Remove ${m.name}`
                            }
                            onClick={() => void handleRemoveMember(m.userUid)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" />
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </div>
      <ToastNotice message={toast} onDismiss={() => setToast(null)} />
    </AppShell>
  );
}

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { locale, t } = useI18n();
  const { state, openSignInModal, getBearerHeaders, refreshAuth } = useAuth();
  const navigate = useNavigate();

  const [meta, setMeta] = useState<{
    orgId: string;
    orgName: string;
    emailHint: string;
    role: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/invitations/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('invalid');
        setMeta(await res.json());
      })
      .catch(() => setErrorMsg(t.notFound.title))
      .finally(() => setLoading(false));
  }, [token, t.notFound.title]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        credentials: 'include',
        headers: getBearerHeaders(),
      });
      if (!res.ok) {
        setErrorMsg(res.status === 403 ? t.errors.forbidden : t.notFound.title);
        return;
      }
      await refreshAuth();
      navigate('/org');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">{t.org.title}</h1>
        {loading && <Skeleton className="h-32 w-full" />}
        {errorMsg && <EmptyState title={errorMsg} />}
        {meta && !errorMsg && (
          <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-base font-bold text-[var(--ink)]">{meta.orgName}</p>
              <p className="text-xs text-[var(--ink-3)]" dir="ltr">
                {meta.emailHint} · {meta.role}
              </p>
            </div>
            {!state.authenticated ? (
              <Button variant="primary" onClick={() => openSignInModal()}>
                {t.nav.signIn}
              </Button>
            ) : (
              <Button variant="primary" loading={accepting} onClick={() => void handleAccept()}>
                {locale === 'ar' ? 'قبول الدعوة والانضمام' : 'Accept Invitation & Join'}
              </Button>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

