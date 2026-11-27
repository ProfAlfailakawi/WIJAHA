/**
 * In-app consent for sending user text to a third-party AI provider (App Store Guidelines 5.1.1(i) / 5.1.2(i)).
 * Shared by the server guard (server.ts) and the client gate (src/lib/ai-consent.tsx).
 */

export type AiMode = 'mock' | 'gemini' | 'claude';
export type AiRecipientId = 'anthropic' | 'google';

/** Request header the client sends after the user agreed; its value names the provider the user agreed to. */
export const AI_CONSENT_HEADER = 'x-wijaha-ai-consent';
export const AI_CONSENT_STORAGE_KEY = 'wijaha_ai_consent_v1';

export interface AiRecipient {
  id: AiRecipientId;
  nameAr: string;
  nameEn: string;
}

export const AI_RECIPIENTS: Record<AiRecipientId, AiRecipient> = {
  anthropic: {
    id: 'anthropic',
    nameAr: 'Anthropic — واجهة Claude البرمجية (Claude API)، تشغّلها شركة Anthropic PBC',
    nameEn: 'Anthropic — Claude API, operated by Anthropic PBC',
  },
  google: {
    id: 'google',
    nameAr: 'Google — واجهة Gemini البرمجية (Gemini API)، تشغّلها شركة Google LLC',
    nameEn: 'Google — Gemini API, operated by Google LLC',
  },
};

/** Which third party (if any) receives user text in the given server AI mode. `mock` sends nothing off-server. */
export function aiRecipientForMode(mode: string | undefined | null): AiRecipientId | null {
  if (mode === 'claude') return 'anthropic';
  if (mode === 'gemini') return 'google';
  return null;
}

export type AiConsentCheck = { ok: true } | { ok: false; recipient: AiRecipientId };

/**
 * Server guard: user text may reach the AI provider only when the request carries consent for that exact provider.
 * Mock mode never contacts a third party, so it needs no consent.
 */
export function checkAiConsent(mode: string, headerValue: unknown): AiConsentCheck {
  const recipient = aiRecipientForMode(mode);
  if (!recipient) return { ok: true };
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof value === 'string' && value.trim().toLowerCase() === recipient) return { ok: true };
  return { ok: false, recipient };
}

export interface StoredAiConsent {
  recipient: AiRecipientId;
  grantedAt: string;
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Stored consent counts only for the provider currently in use; a provider change asks again. */
export function readAiConsent(store: KeyValueStore | null | undefined, recipient: AiRecipientId): boolean {
  if (!store) return false;
  try {
    const raw = store.getItem(AI_CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<StoredAiConsent>;
    return parsed.recipient === recipient;
  } catch {
    return false;
  }
}

export function hasAnyAiConsent(store: KeyValueStore | null | undefined): StoredAiConsent | null {
  if (!store) return null;
  try {
    const raw = store.getItem(AI_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAiConsent>;
    if (parsed.recipient === 'anthropic' || parsed.recipient === 'google') {
      return { recipient: parsed.recipient, grantedAt: String(parsed.grantedAt ?? '') };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeAiConsent(store: KeyValueStore | null | undefined, recipient: AiRecipientId, now = new Date()): void {
  if (!store) return;
  try {
    store.setItem(AI_CONSENT_STORAGE_KEY, JSON.stringify({ recipient, grantedAt: now.toISOString() }));
  } catch {
    /* storage unavailable: consent lasts for this page only */
  }
}

export function clearAiConsent(store: KeyValueStore | null | undefined): void {
  if (!store) return;
  try {
    store.removeItem(AI_CONSENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
