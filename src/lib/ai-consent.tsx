import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button, Dialog } from '../components/ui/Primitives';
import { useI18n } from './i18n';
import {
  AI_CONSENT_HEADER,
  AI_RECIPIENTS,
  type AiRecipientId,
  type StoredAiConsent,
  aiRecipientForMode,
  clearAiConsent,
  hasAnyAiConsent,
  readAiConsent,
  writeAiConsent,
} from '../shared/ai-consent';

/** Result of the gate: headers to attach (consent given), or a reason nothing may be sent. */
export type AiConsentResult =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; reason: 'declined' | 'unavailable' };

interface AiConsentContextValue {
  /** Resolves only after the user decided. Never sends anything itself. */
  ensureAiConsent: () => Promise<AiConsentResult>;
  stored: StoredAiConsent | null;
  withdrawAiConsent: () => void;
}

const AiConsentContext = createContext<AiConsentContextValue | null>(null);

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Non-AI request: which provider (if any) the server would send text to. */
let recipientPromise: Promise<AiRecipientId | null> | null = null;
function loadRecipient(): Promise<AiRecipientId | null> {
  if (!recipientPromise) {
    recipientPromise = fetch('/api/config', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('config');
        return r.json() as Promise<{ aiMode?: string }>;
      })
      .then((c) => aiRecipientForMode(c.aiMode))
      .catch((err) => {
        recipientPromise = null;
        throw err;
      });
  }
  return recipientPromise;
}

export function AiConsentProvider({ children }: { children: React.ReactNode }) {
  const { t, locale, dir } = useI18n();
  const [pending, setPending] = useState<AiRecipientId | null>(null);
  const [stored, setStored] = useState<StoredAiConsent | null>(() => hasAnyAiConsent(safeStorage()));
  const resolverRef = useRef<((r: AiConsentResult) => void) | null>(null);
  // Consent given in this page view still counts if storage is unavailable (private mode).
  const sessionGrantRef = useRef<AiRecipientId | null>(null);

  const ensureAiConsent = useCallback(async (): Promise<AiConsentResult> => {
    let recipient: AiRecipientId | null;
    try {
      recipient = await loadRecipient();
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
    if (!recipient) return { ok: true, headers: {} }; // no third party involved
    const headers = { [AI_CONSENT_HEADER]: recipient };
    if (sessionGrantRef.current === recipient || readAiConsent(safeStorage(), recipient)) {
      return { ok: true, headers };
    }
    resolverRef.current?.({ ok: false, reason: 'declined' });
    return new Promise<AiConsentResult>((resolve) => {
      resolverRef.current = resolve;
      setPending(recipient);
    });
  }, []);

  const finish = useCallback(
    (agreed: boolean) => {
      const recipient = pending;
      setPending(null);
      const resolve = resolverRef.current;
      resolverRef.current = null;
      if (!recipient || !resolve) return;
      if (agreed) {
        sessionGrantRef.current = recipient;
        writeAiConsent(safeStorage(), recipient);
        setStored({ recipient, grantedAt: new Date().toISOString() });
        resolve({ ok: true, headers: { [AI_CONSENT_HEADER]: recipient } });
      } else {
        resolve({ ok: false, reason: 'declined' });
      }
    },
    [pending],
  );

  const withdrawAiConsent = useCallback(() => {
    sessionGrantRef.current = null;
    clearAiConsent(safeStorage());
    setStored(null);
  }, []);

  useEffect(() => () => resolverRef.current?.({ ok: false, reason: 'declined' }), []);

  const value = useMemo(
    () => ({ ensureAiConsent, stored, withdrawAiConsent }),
    [ensureAiConsent, stored, withdrawAiConsent],
  );

  const recipientName = pending ? (locale === 'ar' ? AI_RECIPIENTS[pending].nameAr : AI_RECIPIENTS[pending].nameEn) : '';
  const c = t.aiConsent;

  return (
    <AiConsentContext.Provider value={value}>
      {children}
      <Dialog open={pending !== null} onClose={() => finish(false)} title={c.title}>
        <div dir={dir} className="space-y-4 text-sm leading-relaxed text-[var(--ink-2)]" data-testid="ai-consent-dialog">
          <p className="flex items-start gap-2 text-[var(--ink)]">
            <ShieldCheck className="w-5 h-5 shrink-0 text-[var(--accent,currentColor)]" aria-hidden="true" />
            <span>{c.intro}</span>
          </p>
          <div>
            <h3 className="font-semibold text-[var(--ink)]">{c.whatLabel}</h3>
            <p>{c.what}</p>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--ink)]">{c.whoLabel}</h3>
            <p data-testid="ai-consent-recipient">{recipientName}</p>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--ink)]">{c.whyLabel}</h3>
            <p>{c.why}</p>
          </div>
          <Link
            to="/legal/privacy"
            onClick={() => finish(false)}
            className="inline-block underline text-[var(--ink)] min-h-[44px] leading-[44px]"
          >
            {c.privacyLink}
          </Link>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="primary" onClick={() => finish(true)} data-testid="ai-consent-accept">
              {c.accept}
            </Button>
            <Button variant="secondary" onClick={() => finish(false)} data-testid="ai-consent-decline">
              {c.decline}
            </Button>
          </div>
        </div>
      </Dialog>
    </AiConsentContext.Provider>
  );
}

export function useAiConsent(): AiConsentContextValue {
  const ctx = useContext(AiConsentContext);
  if (!ctx) throw new Error('useAiConsent must be used inside AiConsentProvider');
  return ctx;
}
