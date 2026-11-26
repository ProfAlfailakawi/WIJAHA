import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Maximize2, Radio, TriangleAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { Dialog } from '../../components/ui/Primitives';
import { tr } from '../../components/visuals/svg-kit.tsx';
import { useI18n } from '../../lib/i18n';
import { OpsRoom } from '../../components/visuals/OpsRoom';
import { applyDelay, buildSchedule, EMERGENCIES, formatCountdown, statusAt, TEMPLATES, type Emergency, type Step } from '../../shared/tools/live.ts';
import { btn, btnPrimary, card, input, Page, ToolHero } from './ui';

function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function LivePage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [params] = useSearchParams();
  const [templateId, setTemplateId] = useState(() => (TEMPLATES.some((x) => x.id === params.get('t')) ? (params.get('t') as string) : TEMPLATES[0].id));
  const [startStr, setStartStr] = useState(() => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(params.get('s') ?? '') ? (params.get('s') as string) : localInput(new Date(Date.now() + 130 * 60_000))));
  const [linkCopied, setLinkCopied] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [steps, setSteps] = useState<Step[]>([]);
  const [delayTotal, setDelayTotal] = useState(0);
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const wake = useRef<{ release?: () => Promise<void> } | null>(null);

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  useEffect(() => {
    const start = new Date(startStr);
    setSteps(buildSchedule(template, Number.isNaN(start.getTime()) ? new Date() : start));
    setDelayTotal(0);
  }, [template, startStr]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      void wake.current?.release?.();
    },
    [],
  );

  const status = useMemo(() => statusAt(steps, now), [steps, now]);
  const delay = (m: number) => {
    setSteps((s) => applyDelay(s, new Date(), m));
    setDelayTotal((d) => d + m);
  };
  const keepAwake = async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      wake.current = (await nav.wakeLock?.request('screen')) ?? null;
    } catch {
      /* unsupported or denied */
    }
  };
  const shareLink = () => {
    const s = new Date(startStr);
    if (Number.isNaN(s.getTime())) return;
    const eff = localInput(new Date(s.getTime() + delayTotal * 60_000));
    const url = `${window.location.origin}/live?t=${encodeURIComponent(templateId)}&s=${encodeURIComponent(eff)}`;
    void navigator.clipboard?.writeText(url).then(() => setLinkCopied(true));
  };
  const fullscreen = () => {
    void keepAwake();
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  const clock = new Intl.DateTimeFormat(ar ? 'ar-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const title = (s: Step) => tr(locale, s.ar, s.en);

  return (
    <AppShell>
      <Page>
        <ToolHero
          icon={<Radio className="w-3.5 h-3.5" aria-hidden="true" />}
          kicker={ar ? 'وجاهة مباشر' : 'Protocol LIVE'}
          title={ar ? 'رفيقك يوم الفعالية' : 'Your event-day companion'}
          sub={ar ? 'جدول حي بعدّ تنازلي، وزر تأخير يزيح بقية الفقرات، وأزرار طوارئ تعطيك الخطوات الصحيحة في ثوانٍ.' : 'A live run sheet with countdown, a delay button that shifts the rest, and emergency buttons with the right steps in seconds.'}
        />

        <section className={`${card} grid gap-4 sm:grid-cols-3`} aria-label={ar ? 'الإعداد' : 'Setup'}>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {ar ? 'نوع الفعالية' : 'Event type'}
            <select className={`${input} mt-1`} value={templateId} onChange={(e) => setTemplateId(e.target.value)} data-testid="live-template">
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{tr(locale, t.ar, t.en)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {ar ? 'وقت بدء الفعالية (لحظة الوصول أو الافتتاح)' : 'Event start (arrival or opening moment)'}
            <input type="datetime-local" className={`${input} mt-1`} value={startStr} onChange={(e) => setStartStr(e.target.value)} data-testid="live-start" />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className={btn} onClick={shareLink} data-testid="live-share">
              <Link2 className="w-4 h-4" aria-hidden="true" />
              {linkCopied ? (ar ? 'نُسخ الرابط' : 'Link copied') : ar ? 'انسخ رابط الجدول الحالي للفريق' : 'Copy current schedule link for the team'}
            </button>
            <button type="button" className={btn} onClick={fullscreen} data-testid="live-fullscreen">
              <Maximize2 className="w-4 h-4" aria-hidden="true" />
              {ar ? 'ملء الشاشة وإبقاء الشاشة مضاءة' : 'Fullscreen and keep screen on'}
            </button>
          </div>
        </section>

        <OpsRoom steps={steps} status={status} now={now} emergency={emergency !== null} ar={ar} title={title} />

        <section className={`${card} space-y-4`} aria-live="polite" data-testid="live-status">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--ink-2)]">{ar ? 'الوقت الآن' : 'Now'}: <strong className="text-[var(--ink)]">{clock.format(now)}</strong></p>
            {delayTotal !== 0 && (
              <p className="text-sm font-semibold text-[var(--c-gold)]" data-testid="live-delay">
                {ar ? `تأخير متراكم: ${delayTotal} دقيقة` : `Accumulated delay: ${delayTotal} min`}
              </p>
            )}
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden" role="presentation">
            <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${Math.round(status.progress * 100)}%` }} />
          </div>
          {status.phase === 'before' && status.next && (
            <div>
              <p className="text-[var(--ink-2)]">{ar ? 'تبدأ الفعالية بعد' : 'Starts in'}</p>
              <p className="text-5xl sm:text-7xl font-extrabold tabular-nums text-[var(--ink)]" dir="ltr" data-testid="live-countdown">{formatCountdown(status.secondsToNext ?? 0)}</p>
              <p className="mt-2 text-[var(--ink-2)]">{ar ? 'أول خطوة:' : 'First step:'} <strong className="text-[var(--ink)]">{title(status.next)}</strong></p>
            </div>
          )}
          {status.phase === 'running' && status.current && (
            <div>
              <p className="text-[var(--ink-2)]">{ar ? 'الآن' : 'Now'}</p>
              <p className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)]" data-testid="live-current">{title(status.current)}</p>
              {(ar ? status.current.noteAr : status.current.noteEn) && <p className="mt-1 text-[var(--ink-2)]">{ar ? status.current.noteAr : status.current.noteEn}</p>}
              <p className="mt-2 text-3xl font-bold tabular-nums text-[var(--c-teal)]" dir="ltr">{formatCountdown(status.secondsLeftInCurrent ?? 0)}</p>
              {status.next && <p className="mt-2 text-[var(--ink-2)]">{ar ? 'التالي:' : 'Next:'} <strong className="text-[var(--ink)]">{title(status.next)}</strong></p>}
            </div>
          )}
          {status.phase === 'between' && status.next && (
            <div>
              <p className="text-[var(--ink-2)]">{ar ? 'التالي بعد' : 'Next in'}</p>
              <p className="text-5xl font-extrabold tabular-nums text-[var(--ink)]" dir="ltr">{formatCountdown(status.secondsToNext ?? 0)}</p>
              <p className="text-[var(--ink)] font-semibold">{title(status.next)}</p>
            </div>
          )}
          {status.phase === 'done' && <p className="text-xl font-bold text-[var(--ink)]">{ar ? 'انتهى الجدول. شكراً لكم.' : 'The run sheet is complete. Thank you.'}</p>}
          <div className="flex flex-wrap gap-2" role="group" aria-label={ar ? 'تأخير الجدول' : 'Delay the schedule'}>
            {[5, 10, 15].map((m) => (
              <button key={m} type="button" className={btn} onClick={() => delay(m)} data-testid={`live-delay-${m}`}>
                {ar ? `تأخير ${m} دقائق` : `Delay ${m} min`}
              </button>
            ))}
            <button type="button" className={btn} onClick={() => delay(-5)}>{ar ? 'تقديم 5 دقائق' : 'Advance 5 min'}</button>
          </div>
        </section>

        <section aria-labelledby="em-h" className="space-y-3">
          <h2 id="em-h" className="text-xl font-bold text-[var(--ink)] flex items-center gap-2">
            <TriangleAlert className="w-5 h-5 text-[var(--c-rose)]" aria-hidden="true" />
            {ar ? 'طوارئ: اضغط وستظهر الخطوات' : 'Emergencies: tap for the steps'}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EMERGENCIES.map((e) => (
              <button key={e.id} type="button" className={`${btn} !justify-start !text-start min-h-[56px]`} onClick={() => setEmergency(e)} data-testid={`em-${e.id}`}>
                {tr(locale, e.ar, e.en)}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="sheet-h" className={card}>
          <h2 id="sheet-h" className="text-xl font-bold text-[var(--ink)] mb-3">{ar ? 'الجدول الكامل' : 'Full run sheet'}</h2>
          <ol className="space-y-2">
            {steps.map((s) => {
              const state = status.current?.index === s.index ? 'now' : s.end <= now ? 'done' : 'todo';
              return (
                <li key={s.index} className={`flex items-start gap-3 rounded-xl border p-3 ${state === 'now' ? 'border-[var(--gold)] bg-[var(--surface-2)]' : 'border-[var(--line)]'} ${state === 'done' ? 'opacity-60' : ''}`}>
                  <span className="tabular-nums font-bold text-[var(--ink)] min-w-[3.5rem]" dir="ltr">{clock.format(s.start)}</span>
                  <span className="text-[var(--ink)]">{title(s)}{state === 'done' ? (ar ? ' ✓' : ' ✓') : ''}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <Dialog open={emergency !== null} onClose={() => setEmergency(null)} title={emergency ? tr(locale, emergency.ar, emergency.en) : ''} subtitle={ar ? 'إرشادات استرشادية؛ اتبع تعليمات الجهة المضيفة وجهات الطوارئ.' : 'Advisory guidance; follow the host organisation and emergency services.'}>
          {emergency && (
            <div className="space-y-4">
              <ol className="list-decimal ps-6 space-y-2 text-[var(--ink)]">
                {(ar ? emergency.stepsAr : emergency.stepsEn).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {emergency.delay && (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    delay(emergency.delay!);
                    setEmergency(null);
                  }}
                  data-testid="em-apply-delay"
                >
                  {ar ? `أزِح بقية الجدول ${emergency.delay} دقيقة` : `Push the rest of the schedule ${emergency.delay} min`}
                </button>
              )}
            </div>
          )}
        </Dialog>
      </Page>
    </AppShell>
  );
}
