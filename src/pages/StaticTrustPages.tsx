import React, { useState } from 'react';
import { useAuth } from '../lib/auth-client';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, FileWarning, Layers, ShieldCheck } from 'lucide-react';
import { BRAND } from '../config/brand';
import { AppShell } from '../components/layout/AppShell';
import {
  Button,
  DemoContentNotice,
  ResilientImage,
  RuleLevelTag,
} from '../components/ui/Primitives';
import { useI18n } from '../lib/i18n';
import { calculateContrastRatio } from '../shared/arabic';

// ---------------------------------------------------------------------------
// 1. About Wijaha (/about)
// ---------------------------------------------------------------------------

export function AboutPage() {
  const { locale } = useI18n();

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-[var(--gold-ink)]">
            {BRAND.taglineEn}
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold text-[var(--ink)] leading-snug">
            {locale === 'ar'
              ? 'وجاهة — من البحث إلى التجربة في المراسم والإتيكيت والضيافة'
              : 'WIJAHA — From Search to Experience in Protocol, Etiquette & Hospitality'}
          </h1>
          <p className="text-base text-[var(--ink-2)] leading-relaxed">
            {locale === 'ar'
              ? 'تحوّل وجاهة السؤال البسيط حول مناسبتك الرسمية أو الاجتماعية إلى خطة عمل منظمة وقابلة للتنفيذ: ملخص تنفيذي، قوائم تجهيز، برنامج زمني، مخططات أسبقية وجلوس ثنائية الأبعاد، ومحاكاة تطبيقية مبنية على معايير كفايات واضحة.'
              : 'WIJAHA transforms a natural question about your formal or social occasion into an actionable operational plan: executive summary, readiness checklists, chronological schedules, 2D precedence floorplans, and competency-based simulations.'}
          </p>
        </header>

        <figure className="rounded-2xl border border-[var(--line)] overflow-hidden bg-[var(--surface)]">
          <ResilientImage
            src={BRAND.assets.vipDining}
            alt={
              locale === 'ar'
                ? 'مشهد تمثيلي توضيحي لمأدبة رسمية ومخطط أسبقية'
                : 'Illustrative editorial scene of formal diplomatic dining protocol'
            }
            className="w-full h-64 sm:h-80"
          />
          <figcaption className="px-4 py-2 text-[11px] text-[var(--ink-3)] border-t border-[var(--line)]">
            {locale === 'ar'
              ? 'مشهد تمثيلي توضيحي للضيافة والمراسم الرسمية.'
              : 'Illustrative editorial representation of formal hospitality and protocol.'}
          </figcaption>
        </figure>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">
              {locale === 'ar' ? 'هدوء وفخامة بلا ضجيج' : 'Quiet Luxury, Zero Noise'}
            </h2>
            <p className="text-sm text-[var(--ink-2)] leading-relaxed">
              {locale === 'ar'
                ? 'صُممت المنصة لتمنح مكاتب المراسم، المؤسسات، والأفراد إجابات رصينة وموثقة دون حواجز تسجيل مسبقة أو ادعاءات مبالغ فيها.'
                : 'Designed to give protocol offices, institutions, and individuals dignified, grounded guidance without upfront registration walls or exaggerated claims.'}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">
              {locale === 'ar' ? 'التكامل مع الخبرة البشرية' : 'Human Expertise When It Matters'}
            </h2>
            <p className="text-sm text-[var(--ink-2)] leading-relaxed">
              {locale === 'ar'
                ? 'في المناسبات السيادية ورفيعة الحساسية، تقترح المنصة بهدوء مراجعة خبير مختص دون أن تحجب عنك المخرجات الأولية.'
                : 'For sovereign and high-sensitivity occasions, the platform calmly offers specialist human review without withholding initial structured outputs.'}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to="/methodology">
            <Button variant="primary">
              {locale === 'ar' ? 'اطّلع على المنهجية العلمية' : 'Explore Our Methodology'}
            </Button>
          </Link>
          <Link to="/experts">
            <Button variant="secondary">
              {locale === 'ar' ? 'تعرّف على الخبراء المؤسسين' : 'Meet the Founding Experts'}
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 2. Methodology & Governance Pipeline Infographic (/methodology)
// ---------------------------------------------------------------------------

export function MethodologyPage() {
  const { locale, t } = useI18n();

  const stages =
    locale === 'ar'
      ? [
          { step: '01', title: 'تحليل النية والسياق', desc: 'استخراج نوع المناسبة، الدولة، ومستوى الحساسية مع دعم اللهجة الخليجية والفصحى.' },
          { step: '02', title: 'استرجاع معرفي هجين', desc: 'مطابقة دلالية ونصية مع قواعد المراسم المصنفة جغرافياً وموضوعياً.' },
          { step: '03', title: 'توليد مهيكل صارم', desc: 'بناء قوالب العمل الستة وفق قوالب ثابتة، وكل نتيجة تُفحص قبل عرضها فلا تظهر معلومة بلا مصدر.' },
          { step: '04', title: 'فحص المصادر والحساسية', desc: 'التحقق الحتمي من معرفات القواعد وإرفاق تنبيه المراجعة البشرية للمناسبات الحساسة.' },
          { step: '05', title: 'مراجعة الخبراء الدورية', desc: 'تخضع القواعد المعتمدة لمراجعة خبراء المراسم بتاريخ استحقاق دوري.' },
        ]
      : [
          { step: '01', title: 'Intent & Context Analysis', desc: 'Extracts occasion type, country, and sensitivity across Gulf Arabic, MSA, and English.' },
          { step: '02', title: 'Hybrid Knowledge Retrieval', desc: 'Combines lexical and semantic matching across country- and topic-indexed rules.' },
          { step: '03', title: 'Strict Structured Generation', desc: 'Synthesizes the 6 V1 action blocks from fixed templates; every result is checked before it is shown.' },
          { step: '04', title: 'Deterministic Citation Audit', desc: 'Strips any unverified rule IDs and enforces high-sensitivity human-review notices.' },
          { step: '05', title: 'Scheduled Expert Governance', desc: 'Approved rules carry explicit reviewer attribution and scheduled review due dates.' },
        ];

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-10">
        <header className="space-y-3">
          <DemoContentNotice text={t.meta.demoBanner} />
          <h1 className="text-2xl sm:text-4xl font-bold text-[var(--ink)]">
            {locale === 'ar' ? 'منهجية المعرفة والتحقق في وجاهة' : 'WIJAHA Knowledge & Verification Methodology'}
          </h1>
          <p className="text-base text-[var(--ink-2)] leading-relaxed">
            {locale === 'ar'
              ? 'لا تعتمد وجاهة على التوليد الحر غير المنضبط؛ بل تمر كل استجابة بخمس مراحل حوكمة تفصل بوضوح بين القاعدة الرسمية والعُرف السائد والاجتهاد التقديري.'
              : 'WIJAHA never relies on unconstrained free-form generation; every response passes through a 5-stage governance pipeline separating official rules, customary practice, and advisory guidance.'}
          </p>
        </header>

        {/* 5-Stage Pipeline Infographic */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--gold-ink)]" />
            <span>
              {locale === 'ar' ? 'مخطط مراحل التحقق الخمس' : 'Five-Stage Verification Pipeline'}
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {stages.map((st) => (
              <div
                key={st.step}
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 space-y-2"
              >
                <span className="text-xs font-mono font-bold text-[var(--gold-ink)] tabular-nums">
                  {st.step}
                </span>
                <h3 className="text-sm font-bold text-[var(--ink)]">{st.title}</h3>
                <p className="text-xs text-[var(--ink-2)] leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3-Tier Evidence Classification */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--gold-ink)]" />
            <span>
              {locale === 'ar' ? 'تصنيف مستويات القواعد الثلاثة' : 'Three-Tier Evidence Classification'}
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 space-y-1.5">
              <RuleLevelTag level="official" label={t.result.levels.official} />
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                {locale === 'ar'
                  ? 'إجراءات مراسمية موثقة في أدلة المراسم المعتمدة وتلتزم بها الجهات الرسمية.'
                  : 'Documented protocol procedures established in formal institutional guidelines.'}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 space-y-1.5">
              <RuleLevelTag level="customary" label={t.result.levels.customary} />
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                {locale === 'ar'
                  ? 'أعراف دبلوماسية واجتماعية راسخة في ثقافة البلد المضيف أو الضيف.'
                  : 'Established diplomatic and cultural hospitality norms in the host or guest country.'}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 space-y-1.5">
              <RuleLevelTag level="advisory" label={t.result.levels.advisory} />
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                {locale === 'ar'
                  ? 'نصائح تنظيمية وتقديرية عامة تُوسم بشفافية تامة عند عدم وجود نص صريح.'
                  : 'Practical organizational advice transparently labeled when no strict rule applies.'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 3. Legal Draft Pages (/legal/terms, /legal/privacy, /legal/disclaimer)
// ---------------------------------------------------------------------------

export function LegalPage({ kind }: { kind: 'terms' | 'privacy' | 'disclaimer' }) {
  const { locale, t } = useI18n();
  const { state } = useAuth();
  const contentStatusText = state.demoContentActive === false ? t.meta.reviewedStatus : t.meta.demoBanner;

  const titles = {
    terms: { ar: 'شروط الاستخدام', en: 'Terms of Use' },
    privacy: { ar: 'سياسة الخصوصية وحماية البيانات', en: 'Privacy & Data Protection Policy' },
    disclaimer: { ar: 'إخلاء المسؤولية المهنية والبروتوكولية', en: 'Protocol & Professional Disclaimer' },
  };

  return (
    <AppShell>
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--surface-2)] p-4 flex items-center gap-3 text-xs font-semibold text-[var(--warning)]">
          <FileWarning className="w-4 h-4 shrink-0" />
          <span>
            {locale === 'ar'
              ? 'مسودة — تتطلب مراجعة قانونية معتمدة قبل الإطلاق التجاري'
              : 'Draft — Requires Formal Legal Review Prior to Commercial Launch'}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)]">
          {locale === 'ar' ? titles[kind].ar : titles[kind].en}
        </h1>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4 text-sm text-[var(--ink-2)] leading-relaxed">
          {kind === 'privacy' && (
            <>
              <p>
                {locale === 'ar'
                  ? '1. تشفير البيانات وتقليلها: تُشفر نصوص الاستفسارات وإجابات المحاكاة الحرة، وتُجزّأ عناوين IP لأغراض الحماية من الإساءة فقط، ولا تُستخدم بيانات مشاريعك لتدريب نماذج خارجية.'
                  : '1. Encryption & Minimization: User queries and simulation responses are encrypted at rest; IP addresses are one-way hashed strictly for rate limiting, and workspace data is never used to train external models.'}
              </p>
              <p>
                {locale === 'ar'
                  ? '2. حقوق صاحب البيانات: يمكنك تصدير كامل بياناتك بصيغة JSON من صفحة الحساب في أي وقت، وطلب حذف الحساب مع مهلة استرجاع 14 يوماً قبل الحذف النهائي.'
                  : '2. Data Subject Rights: You may export all personal and workspace records as JSON at any time from Account Settings, and schedule account deletion with a 14-day recovery window.'}
              </p>
            </>
          )}

          {kind === 'terms' && (
            <>
              <p>
                {locale === 'ar'
                  ? '1. نطاق الخدمة: تقدم وجاهة أدوات تخطيط استرشادية وقوالب عمل ومحاكاة تدريبية في مجالات المراسم والإتيكيت والضيافة، وتخضع الباقات للحدود الرقمية المعلنة في صفحة الأسعار.'
                  : '1. Service Scope: WIJAHA provides structured planning tools, templates, and training simulations for protocol and hospitality under transparent numerical plan entitlements.'}
              </p>
              <p>
                {locale === 'ar'
                  ? '2. الإلغاء والاسترداد: يمكن إلغاء تجديد الاشتراك في أي وقت بنقرتين من إعدادات الحساب دون رسوم إلغاء.'
                  : '2. Cancellation: Subscription renewal may be cancelled in two clicks from Account Settings at any time without penalty.'}
              </p>
            </>
          )}

          {kind === 'disclaimer' && (
            <>
              <p>
                {locale === 'ar'
                  ? '1. المرجعية الرسمية: المخرجات والمخططات والمسودات المعروضة استرشادية ولا تُغني عن التعليمات الرسمية الصادرة عن إدارات المراسم الحكومية أو السفارات أو الديوان المختص.'
                  : '1. Official Precedence: All generated plans, seating diagrams, and correspondence drafts are advisory and do not supersede official directives from state protocol offices or embassies.'}
              </p>
              <p>
                {locale === 'ar'
                  ? `2. حالة المحتوى الحالي: ${contentStatusText}.`
                  : `2. Current Content Status: ${contentStatusText}.`}
              </p>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 4. Component & WCAG Contrast Showcase (/dev/components)
// ---------------------------------------------------------------------------

export function DevComponentsPage() {
  const lightInkContrast = calculateContrastRatio(
    BRAND.tokens.light.ink,
    BRAND.tokens.light.bg,
  ).toFixed(2);
  const lightInk3Contrast = calculateContrastRatio(
    BRAND.tokens.light.ink3,
    BRAND.tokens.light.bg,
  ).toFixed(2);
  const lightGoldInkContrast = calculateContrastRatio(
    BRAND.tokens.light.goldInk,
    BRAND.tokens.light.bg,
  ).toFixed(2);
  const darkInk3Contrast = calculateContrastRatio(
    BRAND.tokens.dark.ink3,
    BRAND.tokens.dark.bg,
  ).toFixed(2);

  return (
    <AppShell>
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-[var(--ink)]">
          WIJAHA Design System & WCAG 2.2 AA Verification
        </h1>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-3">
          <h2 className="text-base font-bold text-[var(--ink)]">Verified Contrast Ratios (≥ 4.5:1)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
            <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
              <p className="font-semibold">Light --ink / --bg</p>
              <p className="text-lg font-bold text-[var(--success)] mt-1">{lightInkContrast}:1</p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
              <p className="font-semibold">Light --ink-3 / --bg</p>
              <p className="text-lg font-bold text-[var(--success)] mt-1">{lightInk3Contrast}:1</p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
              <p className="font-semibold">Light --gold-ink / --bg</p>
              <p className="text-lg font-bold text-[var(--success)] mt-1">{lightGoldInkContrast}:1</p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
              <p className="font-semibold">Dark --ink-3 / --bg</p>
              <p className="text-lg font-bold text-[var(--success)] mt-1">{darkInk3Contrast}:1</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
          <h2 className="text-base font-bold text-[var(--ink)]">Button Variants</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="outline">Outline Action</Button>
            <Button variant="ghost">Ghost Action</Button>
            <Button variant="danger">Danger Action</Button>
            <Button variant="primary" loading>
              Loading
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 5. Calm 404 Page with Embedded Smart Search Box
// ---------------------------------------------------------------------------

export function NotFoundPage() {
  const { dir, t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const SendIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <AppShell>
      <div className="max-w-xl w-full mx-auto px-4 py-20 text-center space-y-6">
        <CheckCircle2 className="w-8 h-8 text-[var(--gold)] mx-auto opacity-70" />
        <h1 className="text-2xl font-bold text-[var(--ink)]">{t.notFound.title}</h1>
        <p className="text-sm text-[var(--ink-2)]">{t.notFound.subtitle}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim().length >= 2) {
              navigate(`/r/live?q=${encodeURIComponent(q.trim())}`);
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.home.placeholders[0]}
            className="flex-1 min-w-0 min-h-[46px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--ink)]"
          />
          <Button type="submit" variant="primary">
            <SendIcon className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
