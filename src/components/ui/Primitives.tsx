import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, WifiOff, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useI18n } from '../../lib/i18n';

/**
 * Ceremonial geometric emblem representing hospitality & diplomatic order (Section 7.1)
 */
export function WijahaEmblem({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="4"
        y="4"
        width="28"
        height="28"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M18 8.5L26.5 18L18 27.5L9.5 18L18 8.5Z"
        stroke="var(--gold)"
        strokeWidth="1.5"
      />
      <circle cx="18" cy="18" r="2.2" fill="var(--gold)" />
    </svg>
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-150 select-none whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'min-h-[38px] px-3.5 py-1.5 text-sm',
    md: 'min-h-[44px] px-4.5 py-2.5 text-[15px]',
    lg: 'min-h-[48px] px-6 py-3 text-base',
  };

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-[var(--primary)] text-[var(--bg)] hover:opacity-92 shadow-xs',
    secondary:
      'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--surface)]',
    outline:
      'bg-transparent text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--surface-2)]',
    ghost:
      'bg-transparent text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]',
    danger:
      'bg-[var(--danger)] text-white hover:opacity-90',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

/**
 * Quiet editorial metadata tag — avoids noisy boxed pill clutter (Section 7.1)
 */
export function RuleLevelTag({
  level,
  label,
}: {
  level: 'official' | 'customary' | 'advisory';
  label: string;
}) {
  const tone =
    level === 'official'
      ? 'text-[var(--ink)] font-semibold'
      : level === 'customary'
        ? 'text-[var(--gold-ink)] font-medium'
        : 'text-[var(--ink-3)]';

  return <span className={`text-xs tracking-wide ${tone}`}>{label}</span>;
}

export function DemoContentNotice({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-2)] ${
        compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-xs'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

/**
 * Accessible Modal Dialog with Escape key & focus management (Section 7.6)
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wijaha-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className={`w-full ${maxWidthClass} rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-xl p-6 max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--line)]">
              <div>
                <h2 id="wijaha-dialog-title" className="text-lg font-semibold text-[var(--ink)]">
                  {title}
                </h2>
                {subtitle && <p className="mt-1 text-sm text-[var(--ink-2)]">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.auth.close}
                className="min-w-[44px] min-h-[44px] -m-2 inline-flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pt-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Skeleton({ className = 'h-5 w-full' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-[var(--surface-2)] animate-pulse ${className}`}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 sm:p-10 text-center max-w-xl mx-auto">
      {icon && (
        <div className="w-11 h-11 mx-auto mb-4 rounded-lg bg-[var(--surface-2)] text-[var(--gold-ink)] flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--ink)]">{title}</h3>
      {description && <p className="mt-2 text-sm text-[var(--ink-2)] leading-relaxed">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[var(--danger)]/35 bg-[var(--surface)] p-4 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 text-sm text-[var(--danger)]">
        <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
      {onRetry && retryLabel && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function ToastNotice({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, 3800);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 inset-x-4 sm:inset-x-auto sm:end-6 z-50 max-w-md rounded-xl border border-[var(--line)] bg-[var(--ink)] text-[var(--bg)] px-4 py-3 shadow-lg flex items-center gap-3 text-sm"
    >
      <CheckCircle2 className="w-4 h-4 text-[var(--gold)] shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs opacity-80 hover:opacity-100 px-2 py-1 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Resilient image component with graceful architectural fallback if asset fails
 */
export function ResilientImage({
  src,
  alt,
  fallbackInitials,
  className = '',
}: {
  src?: string | null;
  alt: string;
  fallbackInitials?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-[var(--surface-2)] border border-[var(--line)] text-[var(--gold-ink)] font-semibold select-none ${className}`}
      >
        <span>{fallbackInitials || 'وجاهة'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

export function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[var(--surface-2)] border-b border-[var(--line)] px-4 py-2 text-xs text-[var(--ink-2)] flex items-center justify-center gap-2"
    >
      <WifiOff className="w-3.5 h-3.5 text-[var(--warning)]" aria-hidden="true" />
      <span>{t.meta.offlineBanner}</span>
    </div>
  );
}
