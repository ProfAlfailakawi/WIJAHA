import { signInWithPopup } from 'firebase/auth';
import React, { useCallback, useEffect, useState } from 'react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { NATIVE_RETURN_URL } from '../lib/native-auth';

// Opened by the WIJAHA app in the system browser (see src/lib/native-auth.ts).
// Signs in with Google here, where Google allows it, then hands a one-time code back to the app.
type Phase = 'idle' | 'working' | 'ready' | 'error';

export function NativeAuthPage() {
  const challenge = new URLSearchParams(window.location.search).get('challenge') || '';
  const valid = /^[A-Za-z0-9_-]{43}$/.test(challenge);
  const [phase, setPhase] = useState<Phase>('idle');
  const [returnUrl, setReturnUrl] = useState('');

  const handoff = useCallback(
    async (idToken?: string) => {
      const res = await fetch('/api/auth/native-handoff', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ challenge }),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { code?: string };
      if (!json.code) return false;
      const url = `${NATIVE_RETURN_URL}?code=${encodeURIComponent(json.code)}`;
      setReturnUrl(url);
      setPhase('ready');
      window.location.href = url;
      return true;
    },
    [challenge],
  );

  // Already signed in to WIJAHA in this browser: hand off straight away.
  useEffect(() => {
    if (!valid) return;
    void handoff().catch(() => undefined);
  }, [valid, handoff]);

  const signIn = async () => {
    if (!auth || !googleAuthProvider) {
      setPhase('error');
      return;
    }
    setPhase('working');
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const sync = await fetch('/api/auth/firebase-sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      if (!sync.ok || !(await handoff(idToken))) setPhase('error');
    } catch {
      setPhase('error');
    }
  };

  return (
    <main dir="rtl" className="min-h-[100dvh] grid place-items-center p-6 text-center">
      <div className="max-w-sm w-full space-y-5">
        <h1 className="text-2xl font-bold">تسجيل الدخول إلى تطبيق وجاهة</h1>
        {!valid ? (
          <p>افتح هذه الصفحة من داخل تطبيق وجاهة.</p>
        ) : phase === 'ready' ? (
          <>
            <p>تم تسجيل الدخول. عُد إلى التطبيق لإكمال الدخول.</p>
            <a className="block rounded-xl px-6 py-4 font-semibold bg-[var(--ink,#0a1330)] text-white" href={returnUrl}>
              العودة إلى التطبيق
            </a>
          </>
        ) : (
          <>
            <p>سجّل الدخول بحساب Google، وسنعيدك إلى التطبيق تلقائيًا.</p>
            <button
              type="button"
              onClick={signIn}
              disabled={phase === 'working'}
              className="w-full rounded-xl px-6 py-4 font-semibold bg-[var(--ink,#0a1330)] text-white disabled:opacity-60"
            >
              {phase === 'working' ? 'جارٍ تسجيل الدخول…' : 'المتابعة بحساب Google'}
            </button>
            {phase === 'error' && <p className="text-[var(--danger,#b42318)]">تعذّر تسجيل الدخول. حاول مرة أخرى.</p>}
          </>
        )}
      </div>
    </main>
  );
}
