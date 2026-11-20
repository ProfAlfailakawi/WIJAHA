import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { tr } from '../../components/visuals/svg-kit.tsx';
import { useI18n } from '../../lib/i18n';
import { PERSONAS, scoreAnswer, type Persona, type TurnScore } from '../../shared/tools/voice-sim.ts';
import { btn, btnPrimary, card, input, Page, ToolHero } from './ui';

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getRecognition(): (new () => RecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Exchange {
  guest: string;
  answer: string;
  reaction: string;
  result: TurnScore;
}

export function VoicePage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [persona, setPersona] = useState<Persona | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [log, setLog] = useState<Exchange[]>([]);
  const [listening, setListening] = useState(false);
  const [mute, setMute] = useState(false);
  const rec = useRef<RecognitionLike | null>(null);
  const canListen = typeof window !== 'undefined' && getRecognition() !== null;

  const speak = (text: string) => {
    if (mute || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = ar ? 'ar-SA' : 'en-GB';
      speechSynthesis.speak(u);
    } catch {
      /* speech unavailable */
    }
  };

  const turn = persona?.turns[idx];
  const guestLine = turn ? tr(locale, turn.guestAr, turn.guestEn) : '';
  useEffect(() => {
    if (guestLine) speak(guestLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestLine]);
  useEffect(
    () => () => {
      try {
        speechSynthesis.cancel();
        rec.current?.stop();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const start = (p: Persona) => {
    setPersona(p);
    setIdx(0);
    setLog([]);
    setAnswer('');
  };

  const listen = () => {
    const R = getRecognition();
    if (!R) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    const r = new R();
    r.lang = ar ? 'ar-SA' : 'en-GB';
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => setAnswer((a) => `${a} ${e.results[0][0].transcript}`.trim());
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };

  const submit = () => {
    if (!persona || !turn || !answer.trim()) return;
    const result = scoreAnswer(turn, answer);
    const reaction = tr(locale, ...(turn.reaction[result.tier] as [string, string]).slice(0, 2) as [string, string]);
    setLog((l) => [...l, { guest: guestLine, answer: answer.trim(), reaction, result }]);
    setAnswer('');
    speak(reaction);
    setIdx((i) => i + 1);
  };

  const finished = persona && idx >= persona.turns.length;
  const avg = log.length ? Math.round(log.reduce((a, l) => a + l.result.score, 0) / log.length) : 0;

  return (
    <AppShell>
      <Page>
        <ToolHero
          icon={<Mic className="w-3.5 h-3.5" aria-hidden="true" />}
          kicker={ar ? 'محاكاة صوتية' : 'Voice simulation'}
          title={ar ? 'تدرّب على موقف حقيقي' : 'Practise a real situation'}
          sub={ar ? 'ضيف افتراضي يتحدث إليك بصوته؛ أجبه بصوتك أو كتابة، ثم احصل على تقييم وملاحظات. كله في جهازك وبلا تكلفة.' : 'A virtual guest speaks to you; answer by voice or text, then get a score and notes. All on your device, free.'}
        />

        {!persona && (
          <section className="grid sm:grid-cols-3 gap-4" aria-label={ar ? 'اختر الضيف' : 'Choose a guest'}>
            {PERSONAS.map((p) => (
              <button key={p.id} type="button" onClick={() => start(p)} className={`${card} text-start hover:bg-[var(--surface-2)] cursor-pointer`} data-testid={`persona-${p.id}`}>
                <h2 className="text-lg font-bold text-[var(--ink)]">{tr(locale, p.nameAr, p.nameEn)}</h2>
                <p className="mt-1 text-sm text-[var(--ink-2)]">{tr(locale, p.blurbAr, p.blurbEn)}</p>
              </button>
            ))}
          </section>
        )}

        {persona && (
          <section className={`${card} space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[var(--ink)]">{tr(locale, persona.nameAr, persona.nameEn)}</h2>
              <div className="flex gap-2">
                <button type="button" className={btn} onClick={() => setMute((m) => !m)} aria-pressed={mute}>
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                  {mute ? (ar ? 'الصوت مكتوم' : 'Muted') : ar ? 'كتم الصوت' : 'Mute'}
                </button>
                <button type="button" className={btn} onClick={() => setPersona(null)}>{ar ? 'تغيير الضيف' : 'Change guest'}</button>
              </div>
            </div>

            <ol className="space-y-3" aria-label={ar ? 'المحادثة' : 'Conversation'} data-testid="voice-log">
              {log.map((l, i) => (
                <li key={i} className="space-y-2">
                  <p className="rounded-2xl bg-[var(--surface-2)] p-3 text-[var(--ink)]"><strong>{ar ? 'الضيف: ' : 'Guest: '}</strong>{l.guest}</p>
                  <p className="rounded-2xl border border-[var(--line)] p-3 text-[var(--ink)]"><strong>{ar ? 'أنت: ' : 'You: '}</strong>{l.answer}</p>
                  <p className="rounded-2xl bg-[var(--surface-2)] p-3 text-[var(--ink)]"><strong>{ar ? 'الضيف: ' : 'Guest: '}</strong>{l.reaction}</p>
                  <p className="text-sm text-[var(--ink-2)]">{ar ? 'التقييم' : 'Score'}: <strong className="text-[var(--ink)]">{l.result.score}</strong>/100</p>
                </li>
              ))}
            </ol>

            {!finished && turn && (
              <div className="space-y-3">
                <p className="rounded-2xl bg-[var(--surface-2)] p-3 text-[var(--ink)]" data-testid="voice-guest-line"><strong>{ar ? 'الضيف: ' : 'Guest: '}</strong>{guestLine}</p>
                <button type="button" className={btn} onClick={() => speak(guestLine)}>
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                  {ar ? 'أعد الاستماع' : 'Hear again'}
                </button>
                <label className="block text-sm font-semibold text-[var(--ink)]">
                  {ar ? 'ردّك' : 'Your reply'}
                  <textarea className={`${input} mt-1 min-h-[96px] py-2`} value={answer} onChange={(e) => setAnswer(e.target.value)} data-testid="voice-answer" />
                </label>
                <div className="flex flex-wrap gap-2">
                  {canListen && (
                    <button type="button" className={btn} onClick={listen} aria-pressed={listening}>
                      {listening ? <MicOff className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
                      {listening ? (ar ? 'إيقاف التسجيل' : 'Stop') : ar ? 'تحدّث' : 'Speak'}
                    </button>
                  )}
                  <button type="button" className={btnPrimary} onClick={submit} disabled={!answer.trim()} data-testid="voice-send">
                    <Send className="w-4 h-4" aria-hidden="true" />
                    {ar ? 'أرسل الرد' : 'Send reply'}
                  </button>
                </div>
                {!canListen && <p className="text-sm text-[var(--ink-2)]">{ar ? 'متصفحك لا يدعم التعرّف على الصوت؛ اكتب ردّك. (Chrome وSafari يدعمانه غالباً.)' : 'Your browser has no speech recognition; type your reply. (Chrome and Safari usually support it.)'}</p>}
              </div>
            )}

            {finished && (
              <div className="space-y-3 border-t border-[var(--line)] pt-4" data-testid="voice-report">
                <h3 className="text-xl font-bold text-[var(--ink)]">{ar ? `النتيجة النهائية: ${avg}/100` : `Final score: ${avg}/100`}</h3>
                <ul className="space-y-2 text-[var(--ink)]">
                  {log.flatMap((l, i) => [
                    ...l.result.misses.map((m) => <li key={`m${i}${m.id}`}>• {tr(locale, m.tipAr, m.tipEn)}</li>),
                    ...l.result.penalties.map((p, k) => <li key={`p${i}${k}`}>⚠ {tr(locale, p.tipAr, p.tipEn)}</li>),
                  ])}
                </ul>
                <p className="text-sm text-[var(--ink-2)]">{ar ? 'التقييم قائم على كلمات وعبارات معيّنة؛ هو للتدريب وليس حكماً على كفاءتك.' : 'Scoring is based on key words and phrases; it is for practice, not a judgement of your competence.'}</p>
                <button type="button" className={btnPrimary} onClick={() => start(persona)}>{ar ? 'أعد المحاولة' : 'Try again'}</button>
              </div>
            )}
          </section>
        )}
      </Page>
    </AppShell>
  );
}
