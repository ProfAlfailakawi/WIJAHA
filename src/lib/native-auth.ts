// Google sign-in for the Capacitor app wrappers (Android/iOS).
// Google refuses OAuth inside embedded WebViews, so inside the app we open
// /auth/native in the system browser and get the session back through a deep link
// (wijaha://auth?code=...). The verifier never leaves the app; the browser only sees
// its SHA-256 challenge, so an intercepted code is useless on its own.

type CapPlugin = Record<string, (...args: unknown[]) => Promise<unknown>>;
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, CapPlugin & { addListener?: (e: string, cb: (d: { url?: string }) => void) => unknown }>;
};

const VERIFIER_KEY = 'wijaha_native_verifier';
export const NATIVE_RETURN_URL = 'wijaha://auth';

function cap(): CapacitorGlobal | undefined {
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeApp(): boolean {
  try {
    return Boolean(cap()?.isNativePlatform?.());
  } catch {
    return false;
  }
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  arr.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

export async function startNativeGoogleSignIn(): Promise<boolean> {
  const browser = cap()?.Plugins?.Browser;
  if (!browser?.open) return false;
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  try {
    localStorage.setItem(VERIFIER_KEY, verifier);
  } catch {
    return false;
  }
  const challenge = await challengeFor(verifier);
  await browser.open({ url: `${location.origin}/auth/native?challenge=${challenge}` });
  return true;
}

function completeFromUrl(url: string | undefined): void {
  if (!url || !url.startsWith(NATIVE_RETURN_URL)) return;
  const code = new URL(url.replace(/^wijaha:\/\//, 'https://app/')).searchParams.get('code') || '';
  let verifier = '';
  try {
    verifier = localStorage.getItem(VERIFIER_KEY) || '';
    localStorage.removeItem(VERIFIER_KEY);
  } catch {
    /* storage unavailable */
  }
  void cap()?.Plugins?.Browser?.close?.().catch(() => undefined);
  if (!code || !verifier) return;
  location.href = `/api/auth/native-exchange?code=${encodeURIComponent(code)}&verifier=${encodeURIComponent(verifier)}`;
}

let listening = false;
export function listenForNativeSignIn(): void {
  if (listening || !isNativeApp()) return;
  const app = cap()?.Plugins?.App;
  if (!app?.addListener) return;
  listening = true;
  app.addListener('appUrlOpen', (data) => completeFromUrl(data?.url));
}
