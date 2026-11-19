import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Armchair, Award, BadgeCheck, Briefcase, Building2, CalendarDays, CheckCircle2,
  ClipboardCheck, FolderOpen, Gift, Globe2, GraduationCap, Handshake, Landmark, Lightbulb, Lock, Mail, MapPin,
  PenLine, Plane, Search, ShieldCheck, Sparkles, Target, User, Users, UtensilsCrossed, type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { BRAND } from '../config/brand';
import { AppShell } from '../components/layout/AppShell';
import { WijahaEmblem } from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n } from '../lib/i18n';
import { previewUnderstanding, type PreviewIcon } from '../lib/understanding-preview';

const DRAFT_QUERY_KEY = 'wijaha_draft_query';

const CHIP_ICONS: Record<PreviewIcon, LucideIcon> = {
  delegation: Handshake, meal: UtensilsCrossed, signing: PenLine, gift: Gift, invite: Mail, trip: Plane,
  seating: Armchair, country: MapPin, count: Users, when: CalendarDays, venue: Building2, level: ShieldCheck,
};

type Tone = 'gold' | 'teal' | 'rose' | 'indigo' | 'violet';
const tone = (t: Tone) => ({ background: `var(--t-${t})`, color: `var(--c-${t})` });

function Ico({ icon: Icon, t, size = 56 }: { icon: LucideIcon; t: Tone; size?: number }) {
  return (
    <span className="v2-ico" style={{ ...tone(t), width: size, height: size }}>
      <Icon style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}

/** Eight-point star lattice used as the hero texture. */
function Pattern() {
  return (
    <svg className="v2-pattern" width="100%" height="100%" aria-hidden="true">
      <defs>
        <pattern id="v2star" width="72" height="72" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#E8C882" strokeWidth="1">
            <rect x="18" y="18" width="36" height="36" />
            <rect x="18" y="18" width="36" height="36" transform="rotate(45 36 36)" />
            <circle cx="36" cy="36" r="6" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#v2star)" />
    </svg>
  );
}

/* ---------- Mini infographics for the "what you get" bento ---------- */
const MiniChecklist = () => (
  <svg viewBox="0 0 160 90" className="w-full h-24" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <g key={i} transform={`translate(8 ${10 + i * 26})`}>
        <rect width="20" height="20" rx="6" fill={i < 2 ? 'var(--c-teal)' : 'none'} stroke="var(--c-teal)" strokeWidth="2" />
        {i < 2 && <path d="M5 10l4 4 7-8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />}
        <rect x="30" y="6" width={[110, 84, 96][i]} height="8" rx="4" fill="var(--t-teal)" />
      </g>
    ))}
  </svg>
);
const MiniSeating = () => (
  <svg viewBox="0 0 160 90" className="w-full h-24" aria-hidden="true">
    <circle cx="80" cy="45" r="22" fill="var(--t-gold)" stroke="var(--c-gold)" strokeWidth="2" />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
      return <circle key={i} cx={80 + Math.cos(a) * 36} cy={45 + Math.sin(a) * 36} r="6.5" fill={i === 0 ? 'var(--c-gold)' : 'var(--surface)'} stroke="var(--c-gold)" strokeWidth="2" />;
    })}
  </svg>
);
const MiniTimeline = () => (
  <svg viewBox="0 0 160 90" className="w-full h-24" aria-hidden="true">
    <path d="M14 45H146" stroke="var(--t-indigo)" strokeWidth="6" strokeLinecap="round" />
    {[14, 58, 102, 146].map((x, i) => (
      <g key={x}>
        <circle cx={x} cy="45" r="9" fill={i < 3 ? 'var(--c-indigo)' : 'var(--surface)'} stroke="var(--c-indigo)" strokeWidth="2.5" />
        <rect x={x - 14} y={i % 2 ? 62 : 16} width="28" height="7" rx="3.5" fill="var(--t-indigo)" />
      </g>
    ))}
  </svg>
);
const MiniInvite = () => (
  <svg viewBox="0 0 160 90" className="w-full h-24" aria-hidden="true">
    <rect x="34" y="14" width="92" height="62" rx="8" fill="var(--t-rose)" stroke="var(--c-rose)" strokeWidth="2" />
    <path d="M34 22l46 30 46-30" fill="none" stroke="var(--c-rose)" strokeWidth="2" />
    <circle cx="80" cy="56" r="8" fill="var(--c-rose)" />
  </svg>
);
const MiniRadar = () => (
  <svg viewBox="0 0 160 90" className="w-full h-24" aria-hidden="true">
    {[36, 24, 12].map((r) => <circle key={r} cx="80" cy="45" r={r} fill="none" stroke="var(--t-violet)" strokeWidth="2" />)}
    <polygon points="80,12 108,36 100,68 62,64 50,34" fill="var(--c-violet)" fillOpacity=".25" stroke="var(--c-violet)" strokeWidth="2" />
  </svg>
);
const MiniSeal = () => (
  <svg viewBox="0 0 160 90" className="w-full h-24" aria-hidden="true">
    <circle cx="80" cy="40" r="26" fill="var(--t-gold)" stroke="var(--c-gold)" strokeWidth="2" strokeDasharray="3 4" />
    <circle cx="80" cy="40" r="17" fill="var(--c-gold)" />
    <path d="M72 40l6 6 11-12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    <path d="M66 62l-6 20 20-10 20 10-6-20" fill="var(--t-gold)" stroke="var(--c-gold)" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export function HomePage() {
  const { locale, dir, t } = useI18n();
  const { state } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const ar = locale === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);

  const [query, setQuery] = useState<string>(() =>
    typeof window === 'undefined' ? '' : window.sessionStorage.getItem(DRAFT_QUERY_KEY) || '',
  );
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const understood = useMemo(() => previewUnderstanding(query, locale), [query, locale]);

  useEffect(() => {
    if (reducedMotion || query.length > 0) return;
    const id = window.setInterval(() => setPlaceholderIdx((i) => (i + 1) % t.home.placeholders.length), 4000);
    return () => window.clearInterval(id);
  }, [reducedMotion, query.length, t.home.placeholders.length]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 60), 168)}px`;
  }, [query]);

  const submitSearch = (raw: string) => {
    const s = raw.trim();
    if (s.length < 2 || s.length > 2000) return;
    window.sessionStorage.setItem(DRAFT_QUERY_KEY, s);
    navigate(`/r/live?q=${encodeURIComponent(s)}`);
  };
  const SendIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const exampleIcons = [UtensilsCrossed, Handshake, Plane];

  const steps: Array<[LucideIcon, Tone, string, string]> = [
    [Search, 'gold', L('ابحث', 'Search'), L('اكتب مناسبتك بلغتك أو لهجتك', 'Describe your occasion in your own words')],
    [Lightbulb, 'teal', L('افهم', 'Understand'), L('إجابة مختصرة، لكل نقطة مصدرها', 'A short answer, every point sourced')],
    [ClipboardCheck, 'indigo', L('استعد', 'Prepare'), L('قوائم وبرامج وترتيب جلوس', 'Checklists, programmes, seating')],
    [GraduationCap, 'violet', L('تدرّب', 'Practice'), L('محاكاة لمواقف حقيقية', 'Simulations of real situations')],
    [CheckCircle2, 'rose', L('نفّذ', 'Deliver'), L('ملف جاهز للفريق وخبير عند الحاجة', 'A file for your team, an expert if needed')],
  ];
  const outputs: Array<[React.ReactNode, string, string]> = [
    [<MiniChecklist />, L('قائمة تجهيز', 'Preparation checklist'), L('مهام مرتبة قبل الوصول وأثناءه', 'Ordered tasks before and during')],
    [<MiniSeating />, L('ترتيب الجلوس', 'Seating plan'), L('مخطط تفاعلي للطاولة والأسبقية', 'Interactive table and precedence')],
    [<MiniTimeline />, L('برنامج الزيارة', 'Visit programme'), L('جدول زمني واضح لكل محطة', 'A clear timeline for every stop')],
    [<MiniInvite />, L('دعوة رسمية', 'Formal invitation'), L('مسودة جاهزة بالعربية والإنجليزية', 'A ready draft in Arabic and English')],
    [<MiniRadar />, L('محاكاة وتقييم', 'Simulation & scoring'), L('تقرير أداء حسب سبع كفايات', 'A report across seven competencies')],
    [<MiniSeal />, L('مراجعة خبير', 'Expert review'), L('عند الحاجة فقط، وبلا إزعاج', 'Only when needed, never pushy')],
  ];
  const personas: Array<[LucideIcon, Tone, string, string]> = [
    [User, 'gold', L('فرد', 'Individual'), L('عندي عشاء رسمي، شلون أتصرف؟', 'I have a formal dinner. What do I do?')],
    [UtensilsCrossed, 'rose', L('مطعم وفندق', 'Restaurant & hotel'), L('عندنا وفد VIP من الصين بكرة، شنو نجهز؟', 'A VIP delegation from China arrives tomorrow')],
    [Briefcase, 'indigo', L('شركة', 'Company'), L('بنزور شركاء تجاريين في بولندا', 'We are visiting business partners in Poland')],
    [GraduationCap, 'teal', L('جامعة', 'University'), L('وفد أكاديمي لتوقيع مذكرة تفاهم', 'An academic delegation to sign an MoU')],
    [Landmark, 'violet', L('جهة حكومية', 'Government'), L('خطة استقبال وفد رفيع المستوى', 'A reception plan for a high-level delegation')],
  ];
  const trust: Array<[LucideIcon, Tone, string, string]> = [
    [BadgeCheck, 'teal', L('كل معلومة بمصدرها', 'Every fact is sourced'), L('رسمي أو عُرفي أو تقديري، مع تاريخ المراجعة', 'Official, customary or advisory, with review date')],
    [Award, 'gold', L('خبراء حقيقيون', 'Real experts'), L('مراجعة بشرية للمناسبات الحساسة', 'Human review for sensitive occasions')],
    [Lock, 'indigo', L('بياناتك لك', 'Your data stays yours'), L('خطط مؤسستك لا يراها غيرك', 'Only you see your organisation’s plans')],
  ];

  return (
    <AppShell minimalHome>
      {/* ============ HERO ============ */}
      <section className="v2-hero px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20">
        <Pattern />
        {/* floating icon orbs (desktop) */}
        <div className="hidden lg:block" aria-hidden="true">
          {([[Handshake, '8%', '18%', 84, 0], [UtensilsCrossed, '14%', '62%', 64, 1.2], [Globe2, '84%', '16%', 72, 0.6], [Gift, '88%', '58%', 88, 1.8], [Armchair, '74%', '80%', 56, 2.4], [Mail, '22%', '86%', 52, 3]] as Array<[LucideIcon, string, string, number, number]>).map(([I, left, top, s, d], i) => (
            <span key={i} className="v2-orb v2-float" style={{ left, top, width: s, height: s, animationDelay: `${d}s` }}>
              <I style={{ width: s * 0.42, height: s * 0.42 }} strokeWidth={1.5} />
            </span>
          ))}
        </div>

        <div className="relative w-full max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#E8C882]/40 bg-white/5 text-[#EBCB8B] text-sm">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {L('منصة البروتوكول والمراسم الذكية', 'The smart protocol & ceremony platform')}
          </span>

          <div className="mt-6 flex items-center justify-center gap-3 text-[#EBCB8B]">
            <WijahaEmblem className="w-10 h-10" />
            <span className="font-ceremonial-ar text-5xl sm:text-6xl font-bold text-white leading-none">{ar ? BRAND.nameAr : BRAND.nameEn}</span>
          </div>

          <h1 className="mt-6 text-3xl sm:text-5xl leading-[1.35] sm:leading-[1.3] text-white">
            {L('اكتب مناسبتك،', 'Describe your occasion,')}{' '}
            <span className="text-[#F0CD85]">{L('ونجهّز لك الباقي', 'we prepare the rest')}</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/75 max-w-xl mx-auto">
            {L('خطة جاهزة، وترتيب جلوس، وقائمة تجهيز، وتدريب لفريقك — من سؤال واحد.', 'A ready plan, seating, checklist and team training — from one question.')}
          </p>

          <form onSubmit={(e) => { e.preventDefault(); submitSearch(query); }} className="mt-9 text-start">
            <div className="v2-search p-2.5 flex items-end gap-2">
              <Search className="hidden sm:block w-6 h-6 ms-3 mb-4 text-[var(--ink-3)] shrink-0" aria-hidden="true" />
              <label htmlFor="wijaha-home-search" className="sr-only">{ar ? BRAND.promiseAr : BRAND.promiseEn}</label>
              <textarea
                id="wijaha-home-search" ref={textareaRef} rows={1} maxLength={2000} value={query}
                onChange={(e) => { setQuery(e.target.value); window.sessionStorage.setItem(DRAFT_QUERY_KEY, e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitSearch(query); } }}
                placeholder={t.home.placeholders[placeholderIdx]}
                className="flex-1 min-w-0 resize-none bg-transparent px-3 py-4 text-[1.08rem] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none leading-relaxed"
              />
              <button
                type="submit" disabled={query.trim().length < 2} aria-label={t.home.sendAria}
                className="min-w-[56px] min-h-[56px] px-5 rounded-2xl bg-gradient-to-br from-[#E9C46A] to-[#C9973A] text-[#0A1330] font-bold inline-flex items-center justify-center gap-2 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <span className="hidden sm:inline">{L('جهّز', 'Prepare')}</span>
                <SendIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="min-h-[56px] mt-5" aria-live="polite">
              <AnimatePresence initial={false} mode="wait">
                {understood.length > 0 ? (
                  <motion.div key="u" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center justify-center gap-2">
                    <span className="text-sm font-bold text-[#F0CD85] me-1">{L('فهمنا:', 'We understood:')}</span>
                    {understood.map((c) => {
                      const I = CHIP_ICONS[c.icon];
                      return (
                        <motion.span key={c.key} layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 rounded-full bg-white text-[#0A1330] text-sm font-medium shadow-lg">
                          <I className="w-4 h-4 text-[#B07E1E]" aria-hidden="true" />
                          {c.label}
                        </motion.span>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center justify-center gap-2.5">
                    {t.home.examples.map((ex, i) => {
                      const I = exampleIcons[i % exampleIcons.length];
                      return (
                        <button key={i} type="button" onClick={() => { setQuery(ex.query); submitSearch(ex.query); }}
                          className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-full border border-white/25 bg-white/10 hover:bg-white/20 text-sm text-white transition-colors cursor-pointer">
                          <I className="w-4 h-4 text-[#EBCB8B]" aria-hidden="true" />
                          {ex.label}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>

          {state.authenticated && state.recentProjects && state.recentProjects.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-white/70">
              <FolderOpen className="w-4 h-4 text-[#EBCB8B]" aria-hidden="true" />
              {state.recentProjects.slice(0, 3).map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="underline underline-offset-4 hover:text-white">{p.title}</Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto text-center">
          <span className="v2-kicker"><Target className="w-4 h-4" aria-hidden="true" />{L('كيف تعمل', 'How it works')}</span>
          <h2 className="mt-4 text-2xl sm:text-4xl text-[var(--ink)]">{L('خمس خطوات من السؤال إلى التنفيذ', 'Five steps from question to delivery')}</h2>
          <div className="relative mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-10 gap-x-4">
            <div className="v2-step-line hidden lg:block" aria-hidden="true" />
            {steps.map(([I, tn, title, desc], i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="relative flex flex-col items-center gap-3 px-2">
                <span className="relative">
                  <Ico icon={I} t={tn} size={88} />
                  <span className="absolute -top-2 -end-2 w-8 h-8 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-sm font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
                </span>
                <h3 className="text-xl text-[var(--ink)]">{title}</h3>
                <p className="text-sm text-[var(--ink-2)] leading-relaxed max-w-[200px]">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WHAT YOU GET (bento) ============ */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-[var(--surface-2)]/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <span className="v2-kicker"><Sparkles className="w-4 h-4" aria-hidden="true" />{L('ماذا تحصل', 'What you get')}</span>
            <h2 className="mt-4 text-2xl sm:text-4xl text-[var(--ink)]">{L('نتائج على شكل أدوات… لا نصوص طويلة', 'Results as tools, not walls of text')}</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {outputs.map(([art, title, desc], i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="v2-card p-6">
                <div className="rounded-2xl bg-[var(--bg)] p-3">{art}</div>
                <h3 className="mt-5 text-lg text-[var(--ink)]">{title}</h3>
                <p className="mt-1 text-sm text-[var(--ink-2)]">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WHO IT'S FOR ============ */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <span className="v2-kicker"><Users className="w-4 h-4" aria-hidden="true" />{L('لمن', 'Who it’s for')}</span>
            <h2 className="mt-4 text-2xl sm:text-4xl text-[var(--ink)]">{L('نفس مربع البحث… ونتيجة تناسب كل سائل', 'One search box, a result that fits each asker')}</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {personas.map(([I, tn, who, q]) => (
              <button key={who} type="button" onClick={() => { setQuery(q); window.scrollTo({ top: 0, behavior: 'smooth' }); textareaRef.current?.focus(); }}
                className="v2-card p-5 text-start flex flex-col gap-4 cursor-pointer">
                <Ico icon={I} t={tn} />
                <h3 className="text-lg text-[var(--ink)]">{who}</h3>
                <p className="text-sm leading-relaxed rounded-2xl rounded-ss-sm px-3.5 py-2.5" style={tone(tn)}>«{q}»</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TRUST ============ */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="v2-hero max-w-6xl mx-auto !rounded-[36px] px-6 sm:px-12 py-12">
          <Pattern />
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            {trust.map(([I, , title, desc]) => (
              <div key={title} className="flex items-start gap-4">
                <span className="v2-ico w-14 h-14 bg-white/10 border border-[#E8C882]/40 text-[#EBCB8B]"><I className="w-6 h-6" strokeWidth={1.8} aria-hidden="true" /></span>
                <div>
                  <h3 className="text-lg text-white">{title}</h3>
                  <p className="mt-1 text-sm text-white/70 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
