import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Clock, Sparkles, UserCheck } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import {
  Button,
  ErrorBanner,
  ResilientImage,
  Skeleton,
} from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n } from '../lib/i18n';

interface ExpertRecord {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  titleAr: string;
  titleEn: string;
  bioAr: string;
  bioEn: string;
  avatarUrl: string;
  roleTag: string;
}

interface ServiceRecord {
  id: string;
  owner: string;
  titleAr: string;
  titleEn: string;
  forWhomAr: string;
  forWhomEn: string;
  deliverablesAr: string[];
  deliverablesEn: string[];
  durationAr?: string | null;
  durationEn?: string | null;
  turnaroundAr?: string | null;
  turnaroundEn?: string | null;
  pricingType: 'fixed' | 'quote';
  priceAmountKwd: number | null;
}

function getExpertInitials(nameAr: string, nameEn: string, locale: 'ar' | 'en'): string {
  const raw = (locale === 'ar' ? nameAr : nameEn)
    .replace(/^(د\.|أ\.د\.|Dr\.|Prof\.)\s*/i, '')
    .trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    if (locale === 'ar') {
      const cleanSecond = parts[parts.length - 1].replace(/^ال/, '');
      return `${parts[0][0]} ${cleanSecond[0] || parts[parts.length - 1][0]}`;
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (raw.slice(0, 2) || (locale === 'ar' ? 'خب' : 'EX')).toUpperCase();
}

// ---------------------------------------------------------------------------
// 1. Experts & Advisory Directory (/experts)
// ---------------------------------------------------------------------------

export function ExpertsListPage() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [experts, setExperts] = useState<ExpertRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/experts')
      .then((r) => r.json())
      .then((d: { experts: ExpertRecord[]; services: ServiceRecord[] }) => {
        setExperts(d.experts || []);
        setServices(d.services || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-10">
        <header className="max-w-2xl space-y-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">{t.experts.title}</h1>
          <p className="text-sm sm:text-base text-[var(--ink-2)] leading-relaxed">
            {t.experts.subtitle}
          </p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <>
            {/* Founding Experts Cards (Dignified, zero star ratings or review counters — Section 13.4) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {experts.map((ex) => (
                <article
                  key={ex.id}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 flex flex-col justify-between gap-5"
                >
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <ResilientImage
                        src={ex.avatarUrl || ''}
                        alt={locale === 'ar' ? ex.nameAr : ex.nameEn}
                        fallbackInitials={getExpertInitials(ex.nameAr, ex.nameEn, locale)}
                        className="w-20 h-20 rounded-xl border border-[var(--line)] shrink-0"
                      />
                      <div className="space-y-1">
                        <h2 className="text-lg font-bold text-[var(--ink)]">
                          {locale === 'ar' ? ex.nameAr : ex.nameEn}
                        </h2>
                        <p className="text-xs font-medium text-[var(--gold-ink)] leading-relaxed">
                          {locale === 'ar' ? ex.titleAr : ex.titleEn}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                      {locale === 'ar' ? ex.bioAr : ex.bioEn}
                    </p>
                  </div>

                  <Link to={`/experts/${ex.slug}`}>
                    <Button variant="secondary" className="w-full">
                      <span>{t.experts.viewProfile}</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </article>
              ))}
            </section>

            {/* Advisory & Smart Training Services */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--ink)]">
                {locale === 'ar'
                  ? 'الخدمات الاستشارية والتدريبية المتخصصة'
                  : 'Specialized Advisory & Training Services'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {services.map((srv) => (
                  <article
                    key={srv.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--gold-ink)] tabular-nums">
                        <span>
                          {srv.pricingType === 'fixed' && srv.priceAmountKwd
                            ? locale === 'ar'
                              ? `${srv.priceAmountKwd} د.ك (سعر ثابت)`
                              : `${srv.priceAmountKwd} KWD (Fixed)`
                            : t.pricing.quote}
                        </span>
                        {(srv.turnaroundAr || srv.durationAr) && (
                          <span className="inline-flex items-center gap-1 text-[var(--ink-3)] font-normal">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {locale === 'ar'
                                ? srv.turnaroundAr || srv.durationAr
                                : srv.turnaroundEn || srv.durationEn}
                            </span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-[var(--ink)]">
                        {locale === 'ar' ? srv.titleAr : srv.titleEn}
                      </h3>

                      <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                        <strong className="text-[var(--ink)]">{t.experts.forWhom}</strong>{' '}
                        {locale === 'ar' ? srv.forWhomAr : srv.forWhomEn}
                      </p>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[var(--ink-3)]">
                          {t.experts.deliverables}
                        </p>
                        <ul className="space-y-1 text-xs text-[var(--ink)]">
                          {(
                            (locale === 'ar' ? srv.deliverablesAr : srv.deliverablesEn) || []
                          ).map((del, idx) => (
                            <li key={idx}>• {del}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      onClick={() => navigate(`/request/${srv.id}`)}
                      className="w-full"
                    >
                      {srv.pricingType === 'fixed'
                        ? t.experts.requestService
                        : t.experts.requestQuote}
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 2. Single Expert Profile (/experts/:slug)
// ---------------------------------------------------------------------------

export function ExpertDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale, t } = useI18n();
  const navigate = useNavigate();

  const [expert, setExpert] = useState<ExpertRecord | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/experts/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('missing');
        return (await res.json()) as { expert: ExpertRecord; services: ServiceRecord[] };
      })
      .then((data) => {
        setExpert(data.expert);
        setServices(data.services || []);
      })
      .catch(() => setError(t.notFound.title));
  }, [slug, t.notFound.title]);

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        {error && <ErrorBanner message={error} />}
        {!expert && !error && <Skeleton className="h-64 w-full" />}

        {expert && (
          <>
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 flex flex-col sm:flex-row items-start gap-6">
              <ResilientImage
                src={expert.avatarUrl || ''}
                alt={locale === 'ar' ? expert.nameAr : expert.nameEn}
                fallbackInitials={getExpertInitials(expert.nameAr, expert.nameEn, locale)}
                className="w-28 h-28 rounded-2xl border border-[var(--line)] shrink-0"
              />
              <div className="space-y-3">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--ink)]">
                    {locale === 'ar' ? expert.nameAr : expert.nameEn}
                  </h1>
                  <p className="text-sm font-medium text-[var(--gold-ink)] mt-0.5">
                    {locale === 'ar' ? expert.titleAr : expert.titleEn}
                  </p>
                </div>
                <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                  {locale === 'ar' ? expert.bioAr : expert.bioEn}
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-bold text-[var(--ink)]">
                {locale === 'ar' ? 'الخدمات المتاحة مع الخبير' : 'Available Services'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[var(--gold-ink)] tabular-nums">
                        {srv.pricingType === 'fixed' && srv.priceAmountKwd
                          ? `${srv.priceAmountKwd} KWD`
                          : t.pricing.quote}
                      </p>
                      <h3 className="text-base font-bold text-[var(--ink)]">
                        {locale === 'ar' ? srv.titleAr : srv.titleEn}
                      </h3>
                      <p className="text-xs text-[var(--ink-2)]">
                        {locale === 'ar'
                          ? srv.turnaroundAr || srv.forWhomAr
                          : srv.turnaroundEn || srv.forWhomEn}
                      </p>
                    </div>
                    <Button variant="primary" onClick={() => navigate(`/request/${srv.id}`)}>
                      {srv.pricingType === 'fixed'
                        ? t.experts.requestService
                        : t.experts.requestQuote}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 3. Service Request Form (/request/:serviceId)
// ---------------------------------------------------------------------------

export function ServiceRequestPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;
  const trigger = searchParams.get('trigger') || 'direct';

  const { locale, t } = useI18n();
  const { state, openSignInModal, getBearerHeaders } = useAuth();

  const [service, setService] = useState<ServiceRecord | null>(null);
  const [name, setName] = useState(state.actor?.name || '');
  const [email, setEmail] = useState(state.actor?.email || '');
  const [notes, setNotes] = useState('');
  const [shareContext, setShareContext] = useState(Boolean(projectId));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (state.actor) {
      setName((prev) => prev || state.actor!.name);
      setEmail((prev) => prev || state.actor!.email);
    }
  }, [state.actor]);

  useEffect(() => {
    fetch('/api/experts')
      .then((r) => r.json())
      .then((d: { services: ServiceRecord[] }) => {
        const found = (d.services || []).find((s) => s.id === serviceId);
        if (found) setService(found);
      });
  }, [serviceId]);

  const submitRequestFlow = async () => {
    if (!serviceId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
        body: JSON.stringify({
          serviceId,
          requesterName: name.trim(),
          requesterEmail: email.trim(),
          projectId: shareContext ? projectId : undefined,
          triggerSource: trigger,
          contextShared: shareContext && projectId ? { projectId } : {},
          clientNotes: notes.trim(),
        }),
      });
      if (res.status === 401) {
        openSignInModal(() => void submitRequestFlow());
        return;
      }
      if (!res.ok) {
        setSubmitError(res.status === 403 ? t.errors.forbidden : t.errors.serverError);
        return;
      }
      const data = (await res.json()) as {
        id: string;
        checkoutSessionId?: string;
        checkoutUrl?: string;
        provider?: 'mock' | 'stripe';
      };

      if (data.checkoutSessionId && data.provider === 'mock') {
        await fetch('/api/billing/dev-mock-complete', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getBearerHeaders() },
          body: JSON.stringify({ sessionId: data.checkoutSessionId }),
        });
        setTicketId(data.id);
      } else if (data.checkoutUrl && data.checkoutUrl.startsWith('https://')) {
        window.location.assign(data.checkoutUrl);
      } else {
        setTicketId(data.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.authenticated) {
      openSignInModal(() => void submitRequestFlow());
      return;
    }
    await submitRequestFlow();
  };

  return (
    <AppShell>
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <header className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--gold-ink)] flex items-center gap-1.5">
            <UserCheck className="w-4 h-4" />
            <span>{t.experts.requestFormTitle}</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--ink)]">
            {service
              ? locale === 'ar'
                ? service.titleAr
                : service.titleEn
              : t.experts.requestFormTitle}
          </h1>
        </header>

        {ticketId ? (
          <div className="rounded-2xl border border-[var(--gold)] bg-[var(--surface)] p-8 text-center space-y-4">
            <CheckCircle2 className="w-10 h-10 text-[var(--success)] mx-auto" />
            <h2 className="text-lg font-bold text-[var(--ink)]">{t.experts.requestSuccess}</h2>
            <p className="text-xl font-mono font-bold text-[var(--gold-ink)] tabular-nums" dir="ltr">
              {ticketId}
            </p>
            <Link to="/experts">
              <Button variant="secondary">{t.nav.experts}</Button>
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4"
          >
            {submitError && <ErrorBanner message={submitError} />}
            {service?.pricingType === 'fixed' && (
              <div className="rounded-lg bg-[var(--surface-2)] p-3.5 text-xs text-[var(--ink-2)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--gold-ink)] shrink-0" />
                <span>
                  {t.experts.fixedPayNotice} ({service.priceAmountKwd} KWD)
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--ink)]">
                {t.experts.nameLabel}
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--ink)]">
                {t.experts.emailLabel}
              </label>
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--ink)]">
                {t.experts.notesLabel}
              </label>
              <textarea
                rows={4}
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5 text-sm text-[var(--ink)]"
              />
            </div>

            {projectId && (
              <label className="flex items-center gap-2.5 text-xs text-[var(--ink-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareContext}
                  onChange={(e) => setShareContext(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>{t.experts.shareContextCheck}</span>
              </label>
            )}

            <Button type="submit" variant="primary" loading={submitting} className="w-full">
              {t.experts.submitRequest}
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
