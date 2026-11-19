import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import arMessages from '../messages/ar.json';
import enMessages from '../messages/en.json';
import { Locale } from '../shared/types';

type Messages = typeof arMessages;
export type ThemeMode = 'light' | 'dark' | 'system';

interface I18nContextValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: Messages;
  setLocale: (next: Locale) => void;
  theme: ThemeMode;
  resolvedDark: boolean;
  setTheme: (next: ThemeMode) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'ar';
  const pathSeg = window.location.pathname.split('/')[1];
  if (pathSeg === 'en' || pathSeg === 'ar') return pathSeg;
  const match = document.cookie.match(/(?:^|;\s*)wijaha_locale=(ar|en)/);
  if (match && (match[1] === 'ar' || match[1] === 'en')) return match[1];
  return 'ar';
}

function detectInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem('wijaha_theme');
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'light';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);
  const [theme, setThemeState] = useState<ThemeMode>(detectInitialTheme);
  const [resolvedDark, setResolvedDark] = useState<boolean>(false);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    document.cookie = `wijaha_locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    window.localStorage.setItem('wijaha_theme', next);
  };

  useEffect(() => {
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  useEffect(() => {
    const applyTheme = () => {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
      setResolvedDark(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [theme]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      t: locale === 'ar' ? arMessages : enMessages,
      setLocale,
      theme,
      resolvedDark,
      setTheme,
    }),
    [locale, theme, resolvedDark],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
