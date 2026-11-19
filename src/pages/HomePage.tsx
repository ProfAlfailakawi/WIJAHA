import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Armchair, Building2, CalendarDays, FolderOpen, Gift, Handshake,
  Mail, MapPin, PenLine, Plane, ShieldCheck, Users, UtensilsCrossed, type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { BRAND } from '../config/brand';
import { AppShell } from '../components/layout/AppShell';
import { WijahaEmblem } from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n } from '../lib/i18n';
import { previewUnderstanding, type PreviewIcon } from '../lib/understanding-preview';

const CHIP_ICONS: Record<PreviewIcon, LucideIcon> = {
  delegation: Handshake, meal: UtensilsCrossed, signing: PenLine, gift: Gift, invite: Mail, trip: Plane,
  seating: Armchair, country: MapPin, count: Users, when: CalendarDays, venue: Building2, level: ShieldCheck,
};

const DRAFT_QUERY_KEY = 'wijaha_draft_query';

/** Fine line drawing of a ceremonial hall: a round table, ten seats and the host's place. Purely decorative. */
function HallDrawing() {
  const seats = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    return { x: 300 + Math.cos(a) * 112, y: 160 + Math.sin(a) * 112, host: i === 0 };
  });
  return (
    <svg
      viewBox="0 0 600 320"
      className="wj-draw w-full max-w-xl mx-auto text-[var(--gold)] opacity-70"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M40 300 H560" strokeWidth="1" style={{ ['--len' as string]: 520 }} />
      <path d="M90 300 V120 Q300 -10 510 120 V300" strokeWidth="1" style={{ ['--len' as string]: 900 }} />
      <circle cx="300" cy="160" r="70" strokeWidth="1.2" style={{ ['--len' as string]: 440 }} />
      <circle cx="300" cy="160" r="62" strokeWidth="0.6" strokeDasharray="2 5" />
      {seats.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.host ? 9 : 7}
          strokeWidth={s.host ? 1.6 : 1}
          fill={s.host ? 'currentColor' : 'none'}
          style={{ ['--len' as string]: 60, animationDelay: `${0.9 + i * 0.07}s` }}
        />
      ))}
      <path d="M300 300 V250" strokeWidth="1" style={{ ['--len' as string]: 60 }} />
    </svg>
  );
}

export function HomePage() {
  const { locale, dir, t } = useI18n();
  const { state } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const isAr = locale === 'ar';

  const [query, setQuery] = useState<string>(() =>
    typeof window === 'undefined' ? '' : window.sessionStorage.getItem(DRAFT_QUERY_KEY) || '',
  );
  const [focused, setFocused] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Signature moment: show what WIJAHA understood while the person is still typing.
  const understood = useMemo(() => previewUnderstanding(query, locale), [query, locale]);

  useEffect(() => {
    if (focused || reducedMotion || query.length > 0) return;
    const id = window.setInterval(() => setPlaceholderIdx((i) => (i + 1) % t.home.placeholders.length), 4000);
    return () => window.clearInterval(id);
  }, [focused, reducedMotion, query.length, t.home.placeholders.length]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 64), 176)}px`;
  }, [query]);

  const submitSearch = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < 2 || trimmed.length > 2000) return;
    window.sessionStorage.setItem(DRAFT_QUERY_KEY, trimmed);
    navigate(`/r/live?q=${encodeURIComponent(trimmed)}`);
  };

  const SendIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const canSend = query.trim().length >= 2;

  return (
    <AppShell minimalHome>
      <section className="relative flex-1 flex flex-col items-center px-4 sm:px-6 pt-14 sm:pt-20 pb-10">
        <div className="w-full max-w-2xl mx-auto text-center">
          {/* Seal + name */}
          <div className="wj-rise flex flex-col items-center gap-5">
            <div className="relative w-16 h-16 flex items-center justify-center text-[var(--gold)]">
              <span className="absolute inset-0 border border-[var(--gold-soft)] rotate-45 rounded-[3px]" aria-hidden="true" />
              <WijahaEmblem className="w-8 h-8" />
            </div>
            <div>
              <p className="wj-display text-5xl sm:text-6xl leading-tight text-[var(--ink)]">
                {isAr ? BRAND.nameAr : BRAND.nameEn}
              </p>
              <p className="mt-1 text-[0.7rem] tracking-[0.5em] text-[var(--gold-ink)] uppercase">
                {isAr ? BRAND.nameEn : BRAND.nameAr}
              </p>
            </div>
          </div>

          <h1 className="wj-rise mt-8 text-2xl sm:text-[2.1rem] leading-snug text-[var(--ink)]" style={{ animationDelay: '80ms' }}>
            {t.home.promise}
          </h1>

          {/* The invitation card search box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch(query);
            }}
            className="wj-rise mt-9 text-start"
            style={{ animationDelay: '160ms' }}
          >
            <div
              className={`wj-invitation p-3 sm:p-3.5 flex items-end gap-2 transition-shadow ${
                focused ? 'ring-1 ring-[var(--gold)]' : ''
              }`}
            >
              <label htmlFor="wijaha-home-search" className="sr-only">
                {isAr ? BRAND.promiseAr : BRAND.promiseEn}
              </label>
              <textarea
                id="wijaha-home-search"
                ref={textareaRef}
                rows={1}
                maxLength={2000}
                value={query}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  window.sessionStorage.setItem(DRAFT_QUERY_KEY, e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitSearch(query);
                  }
                }}
                placeholder={t.home.placeholders[placeholderIdx]}
                className="flex-1 resize-none bg-transparent px-4 py-4 text-[1.05rem] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none leading-relaxed"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label={t.home.sendAria}
                className="m-1 min-w-[52px] min-h-[52px] rounded-[6px] bg-[var(--primary)] text-[var(--primary-fg)] inline-flex items-center justify-center transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Live understanding */}
            <div className="min-h-[52px] mt-4" aria-live="polite">
              <AnimatePresence initial={false}>
                {understood.length > 0 ? (
                  <motion.div
                    key="understood"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-wrap items-center justify-center gap-2"
                  >
                    <span className="wj-eyebrow me-1">{isAr ? 'فهمنا:' : 'We understood:'}</span>
                    {understood.map((c) => {
                      const Icon = CHIP_ICONS[c.icon];
                      return (
                      <motion.span
                        key={c.key}
                        layout
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="wj-chip"
                      >
                        <Icon className="w-3.5 h-3.5 text-[var(--gold-ink)]" aria-hidden="true" />
                        {c.label}
                      </motion.span>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div key="examples" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center justify-center gap-2.5">
                    {t.home.examples.map((ex, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setQuery(ex.query);
                          submitSearch(ex.query);
                        }}
                        className="min-h-[40px] px-4 rounded-full border border-[var(--line)] bg-transparent hover:bg-[var(--surface)] hover:border-[var(--gold-soft)] text-sm text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {query.length >= 1500 && (
              <p className="mt-1 text-center text-xs tabular-nums text-[var(--ink-3)]">
                {query.length} / 2000 ({t.home.charLimit})
              </p>
            )}
          </form>

          {state.authenticated && state.recentProjects && state.recentProjects.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-[var(--ink-3)]">
              <span className="inline-flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-[var(--gold-ink)]" aria-hidden="true" />
                {t.home.recentProjects}
              </span>
              {state.recentProjects.slice(0, 3).map((proj) => (
                <Link key={proj.id} to={`/projects/${proj.id}`} className="text-[var(--ink-2)] hover:text-[var(--ink)] underline decoration-[var(--gold-soft)] underline-offset-4">
                  {proj.title}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quiet signature drawing + the five verbs */}
        <div className="w-full max-w-3xl mx-auto mt-auto pt-12">
          <HallDrawing />
          <div className="wj-rule mt-2 text-xs">
            <span className="tracking-wide text-[var(--gold-ink)] whitespace-nowrap">
              {(isAr ? BRAND.fiveVerbsAr : BRAND.fiveVerbsEn).join('  ·  ')}
            </span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
