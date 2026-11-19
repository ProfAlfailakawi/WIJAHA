import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from './firebase';
import { useI18n, type ThemeMode } from './i18n';
import type { Locale } from '../shared/types';

export interface AuthActor {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  platformRole: string;
  activeOrgId: string;
  orgRole: string;
  mfaVerified: boolean;
  expertSuggestionsEnabled: boolean;
}

export interface OrgEntitlements {
  planId: string;
  resultsPerMonth: number;
  projectsMax: number;
  seats: number;
  exportsWatermark: boolean;
}

export interface AuthMeState {
  authenticated: boolean;
  actor: AuthActor | null;
  preferences?: {
    locale: Locale;
    theme: ThemeMode;
    expertSuggestionsEnabled: boolean;
  };
  org?: {
    id: string;
    name: string;
    slug: string;
    planId: string;
    isPersonal: boolean;
  } | null;
  entitlements?: OrgEntitlements;
  usage?: {
    resultsUsed: number;
    resultsLimit: number;
  };
  recentProjects?: Array<{ id: string; title: string }>;
  aiMode?: string;
}

interface AuthContextValue {
  state: AuthMeState;
  loading: boolean;
  signInModalOpen: boolean;
  openSignInModal: (onSuccess?: () => void) => void;
  closeSignInModal: () => void;
  refreshAuth: () => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  sendMagicCode: (email: string) => Promise<{ ok: boolean; devPreviewCode?: string; error?: string }>;
  verifyMagicCode: (email: string, code: string) => Promise<boolean>;
  signInDemoAccount: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  getBearerHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setLocale, setTheme } = useI18n();
  const [state, setState] = useState<AuthMeState>({
    authenticated: false,
    actor: null,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [signInModalOpen, setSignInModalOpen] = useState<boolean>(false);
  // Keep ID token strictly in memory (never localStorage — Section 21.1)
  const memoryIdTokenRef = useRef<string | null>(null);
  const pendingCallbackRef = useRef<(() => void) | null>(null);

  const getBearerHeaders = useCallback((): Record<string, string> => {
    if (memoryIdTokenRef.current) {
      return { Authorization: `Bearer ${memoryIdTokenRef.current}` };
    }
    return {};
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: getBearerHeaders(),
      });
      if (!res.ok) {
        setState({ authenticated: false, actor: null });
        return;
      }
      const data = (await res.json()) as AuthMeState;
      setState(data);
    } catch {
      setState({ authenticated: false, actor: null });
    } finally {
      setLoading(false);
    }
  }, [getBearerHeaders]);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const completeLoginSuccess = useCallback(async () => {
    await refreshAuth();
    setSignInModalOpen(false);
    const cb = pendingCallbackRef.current;
    pendingCallbackRef.current = null;
    if (cb) {
      setTimeout(() => cb(), 60);
    }
  }, [refreshAuth]);

  const openSignInModal = useCallback((onSuccess?: () => void) => {
    pendingCallbackRef.current = onSuccess ?? null;
    setSignInModalOpen(true);
  }, []);

  const closeSignInModal = useCallback(() => {
    pendingCallbackRef.current = null;
    setSignInModalOpen(false);
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      memoryIdTokenRef.current = idToken;
      const syncRes = await fetch('/api/auth/firebase-sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (!syncRes.ok) return false;
      await completeLoginSuccess();
      return true;
    } catch {
      return false;
    }
  }, [completeLoginSuccess]);

  const sendMagicCode = useCallback(async (email: string) => {
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        devPreviewCode?: string;
        error?: { code?: string };
      };
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error?.code || 'MAGIC_FAILED' };
      }
      return { ok: true, devPreviewCode: json.devPreviewCode };
    } catch {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
  }, []);

  const verifyMagicCode = useCallback(
    async (email: string, code: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/auth/magic-verify', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code }),
        });
        if (!res.ok) return false;
        await completeLoginSuccess();
        return true;
      } catch {
        return false;
      }
    },
    [completeLoginSuccess],
  );

  const signInDemoAccount = useCallback(
    async (email: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/auth/demo-login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) return false;
        await completeLoginSuccess();
        return true;
      } catch {
        return false;
      }
    },
    [completeLoginSuccess],
  );

  const signOut = useCallback(async () => {
    memoryIdTokenRef.current = null;
    try {
      await auth.signOut().catch(() => undefined);
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setState({ authenticated: false, actor: null });
    }
  }, []);

  // Keep synced preferences available when explicitly changed on Account page
  void setLocale;
  void setTheme;

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      loading,
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
      refreshAuth,
      signInWithGoogle,
      sendMagicCode,
      verifyMagicCode,
      signInDemoAccount,
      signOut,
      getBearerHeaders,
    }),
    [
      state,
      loading,
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
      refreshAuth,
      signInWithGoogle,
      sendMagicCode,
      verifyMagicCode,
      signInDemoAccount,
      signOut,
      getBearerHeaders,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
