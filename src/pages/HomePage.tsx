import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FolderOpen } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { BRAND } from '../config/brand';
import { AppShell } from '../components/layout/AppShell';
import { WijahaEmblem } from '../components/ui/Primitives';
import { useAuth } from '../lib/auth-client';
import { useI18n } from '../lib/i18n';

const DRAFT_QUERY_KEY = 'wijaha_draft_query';

export function HomePage() {
  const { locale, dir, t } = useI18n();
  const { state } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const [query, setQuery] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(DRAFT_QUERY_KEY) || '';
  });
  const [focused, setFocused] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rotate smart placeholder every 4s unless focused or reduced-motion (Section 8.1)
  useEffect(() => {
    if (focused || reducedMotion || query.length > 0) return;
    const id = window.setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % t.home.placeholders.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [focused, reducedMotion, query.length, t.home.placeholders.length]);

  // Auto-resize textarea cleanly from 1 to 5 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(Math.max(el.scrollHeight, 56), 168);
    el.style.height = `${nextHeight}px`;
  }, [query]);

  const submitSearch = (rawText: string) => {
    const trimmed = rawText.trim();
    if (trimmed.length < 2 || trimmed.length > 2000) return;
    window.sessionStorage.setItem(DRAFT_QUERY_KEY, trimmed);
    navigate(`/r/live?q=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitSearch(query);
    }
  };

  const SendIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <AppShell minimalHome>
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20">
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="w-full max-w-2xl mx-auto text-center space-y-8"
        >
          {/* Quiet Ceremonial Identity */}
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-2xs">
              <WijahaEmblem className="w-7 h-7" />
            </div>

            <p className="text-xs font-medium tracking-widest text-[var(--gold-ink)]">
              {t.home.subtitle}
            </p>

            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--ink)] leading-snug">
              {t.home.promise}
            </h1>
          </div>

          {/* Single-Entry Smart Search Box (Section 8.1) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch(query);
            }}
            className="text-start"
          >
            <div
              className={`rounded-2xl border bg-[var(--surface)] shadow-sm transition-colors p-2 sm:p-2.5 flex items-end gap-2 ${
                focused ? 'border-[var(--gold)]' : 'border-[var(--line)]'
              }`}
            >
              <label htmlFor="wijaha-home-search" className="sr-only">
                {locale === 'ar' ? BRAND.promiseAr : BRAND.promiseEn}
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
                onKeyDown={handleKeyDown}
                placeholder={t.home.placeholders[placeholderIdx]}
                className="flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none leading-relaxed"
              />

              <button
                type="submit"
                disabled={query.trim().length < 2}
                aria-label={t.home.sendAria}
                className="min-w-[46px] min-h-[46px] rounded-xl bg-[var(--primary)] text-[var(--bg)] inline-flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>

            {query.length >= 1500 && (
              <div className="mt-1.5 flex justify-end text-xs tabular-nums text-[var(--ink-3)]">
                {query.length} / 2000 ({t.home.charLimit})
              </div>
            )}
          </form>

          {/* Exactly 3 Clickable Occasion Examples */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {t.home.examples.map((ex, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(ex.query);
                  submitSearch(ex.query);
                }}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-sm text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              >
                {ex.label}
              </button>
            ))}
          </div>

          {/* Quiet Recent Projects Line (Max 3, only when authenticated with projects) */}
          {state.authenticated && state.recentProjects && state.recentProjects.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-[var(--ink-3)]">
              <span className="inline-flex items-center gap-1">
                <FolderOpen className="w-3.5 h-3.5 text-[var(--gold-ink)]" aria-hidden="true" />
                <span>{t.home.recentProjects}</span>
              </span>
              {state.recentProjects.slice(0, 3).map((proj) => (
                <Link
                  key={proj.id}
                  to={`/projects/${proj.id}`}
                  className="text-[var(--ink-2)] hover:text-[var(--ink)] underline underline-offset-4"
                >
                  {proj.title}
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}
