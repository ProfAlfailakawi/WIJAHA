import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Download } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { downloadPng } from '../../components/visuals/export.ts';
import { tr } from '../../components/visuals/svg-kit.tsx';
import { useI18n } from '../../lib/i18n';
import { PassportSeals } from '../../components/visuals/PassportSeals';
import { EXAM, MODULES, PASS_MARK } from '../../shared/tools/learn.ts';
import { btn, btnPrimary, card, input, Page, ToolHero } from './ui';

const FONT = "Alexandria, 'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif";

export function CertificateSvg({ name, correct, total, date, code, locale, svgRef }: { name: string; correct: number; total: number; date: string; code: string; locale: string; svgRef?: React.Ref<SVGSVGElement> }) {
  const ar = locale === 'ar';
  const dir = ar ? 'rtl' : 'ltr';
  const verify = `wijaha.web.app/verify/${code.slice(0, 18)}…`;
  return (
    <svg ref={svgRef} viewBox="0 0 1600 1130" className="w-full h-auto" role="img" aria-label={ar ? `شهادة وجاهة باسم ${name}` : `WIJAHA certificate for ${name}`} style={{ fontFamily: FONT, direction: dir }}>
      <rect width="1600" height="1130" fill="#fbf7ea" />
      <rect x="40" y="40" width="1520" height="1050" fill="none" stroke="#b8923a" strokeWidth="6" />
      <rect x="66" y="66" width="1468" height="998" fill="none" stroke="#b8923a" strokeWidth="2" />
      <path d="M800 120l26 26-26 26-26-26z" fill="#b8923a" />
      <text x="800" y="250" textAnchor="middle" fontSize="64" fontWeight="800" fill="#14213d">{ar ? 'شهادة إتمام مسار وجاهة' : 'WIJAHA Certificate of Completion'}</text>
      <text x="800" y="340" textAnchor="middle" fontSize="34" fill="#4a4a4a">{ar ? 'تشهد وجاهة بأن' : 'WIJAHA certifies that'}</text>
      <text x="800" y="480" textAnchor="middle" fontSize="88" fontWeight="800" fill="#14213d">{name}</text>
      <line x1="400" y1="520" x2="1200" y2="520" stroke="#b8923a" strokeWidth="3" />
      <text x="800" y="610" textAnchor="middle" fontSize="36" fill="#4a4a4a">{ar ? 'أتم مسار البروتوكول والإتيكيت واجتاز الاختبار' : 'completed the protocol and etiquette path and passed the exam'}</text>
      <text x="800" y="680" textAnchor="middle" fontSize="40" fontWeight="700" fill="#14213d">{ar ? `الدرجة: ${correct} من ${total}` : `Score: ${correct} of ${total}`}</text>
      <text x="800" y="750" textAnchor="middle" fontSize="30" fill="#4a4a4a" style={{ direction: 'ltr' }}>{date}</text>
      <text x="800" y="900" textAnchor="middle" fontSize="26" fill="#4a4a4a">{ar ? 'للتحقق من صحة الشهادة:' : 'To verify this certificate:'}</text>
      <text x="800" y="945" textAnchor="middle" fontSize="26" fill="#14213d" style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}>{verify}</text>
      <text x="800" y="1010" textAnchor="middle" fontSize="22" fill="#6b6b6b">{ar ? 'شهادة تدريبية استرشادية صادرة من منصة وجاهة، وليست اعتماداً مهنياً أو حكومياً.' : 'An advisory training certificate from the WIJAHA platform; not a professional or government accreditation.'}</text>
    </svg>
  );
}

interface ExamResult {
  correct: number;
  total: number;
  passed: boolean;
  reviewModules: string[];
  code?: string;
}

export function LearnPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState('');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const complete = EXAM.every((q) => answers[q.id] !== undefined);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/certificate/exam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers, name }) });
      if (!r.ok) throw new Error(String(r.status));
      setResult((await r.json()) as ExamResult);
    } catch {
      setError(ar ? 'تعذّر إرسال الاختبار الآن. حاول لاحقاً.' : 'Could not submit the exam now. Try again later.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <Page>
        <ToolHero
          icon={<Award className="w-3.5 h-3.5" aria-hidden="true" />}
          kicker={ar ? 'مسار التعلّم' : 'Learning path'}
          title={ar ? 'تعلّم، اختبر، واحصل على شهادة' : 'Learn, take the exam, get a certificate'}
          sub={ar ? 'ستة محاور قصيرة ثم اختبار من 15 سؤالاً يصحَّح على الخادم. عند النجاح تحصل على شهادة برمز تحقق يستطيع أي شخص فحصه.' : 'Six short modules, then a 15-question exam graded on the server. On a pass you get a certificate with a code anyone can verify.'}
        />

        <section aria-labelledby="mods-h" className="space-y-4">
          <h2 id="mods-h" className="text-2xl font-bold text-[var(--ink)]">{ar ? 'المحاور' : 'Modules'}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {MODULES.map((m) => (
              <article key={m.id} className={card} id={m.id} data-testid={`module-${m.id}`}>
                <h3 className="text-lg font-bold text-[var(--ink)]">{tr(locale, m.ar, m.en)}</h3>
                <ul className="mt-2 list-disc ps-5 space-y-1.5 text-[var(--ink)] leading-relaxed">
                  {(ar ? m.pointsAr : m.pointsEn).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="exam-h" className={`${card} space-y-5`}>
          <h2 id="exam-h" className="text-2xl font-bold text-[var(--ink)]">{ar ? `الاختبار (النجاح ${PASS_MARK} من ${EXAM.length})` : `Exam (pass: ${PASS_MARK} of ${EXAM.length})`}</h2>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {ar ? 'الاسم كما سيظهر على الشهادة' : 'Name as it should appear on the certificate'}
            <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} data-testid="exam-name" />
          </label>
          <ol className="space-y-5">
            {EXAM.map((q, n) => (
              <li key={q.id}>
                <fieldset>
                  <legend className="font-bold text-[var(--ink)]">{n + 1}. {tr(locale, q.ar, q.en)}</legend>
                  <div className="mt-2 grid gap-2">
                    {(ar ? q.optionsAr : q.optionsEn).map((o, i) => (
                      <label key={i} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer min-h-[44px] ${answers[q.id] === i ? 'border-[var(--gold)] bg-[var(--surface-2)]' : 'border-[var(--line)]'}`}>
                        <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))} className="accent-[var(--gold)] w-4 h-4" data-testid={`ans-${q.id}-${i}`} />
                        <span className="text-[var(--ink)]">{o}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
          {error && <p role="alert" className="text-[var(--c-rose)] font-semibold">{error}</p>}
          <button type="button" className={btnPrimary} disabled={!complete || busy || name.trim().length < 2} onClick={() => void submit()} data-testid="exam-submit">
            {busy ? (ar ? 'جارٍ التصحيح…' : 'Grading…') : ar ? 'سلّم الاختبار' : 'Submit exam'}
          </button>
          {!complete && <p className="text-sm text-[var(--ink-2)]">{ar ? 'أجب عن كل الأسئلة واكتب اسمك لتفعيل الزر.' : 'Answer every question and enter your name to enable the button.'}</p>}
        </section>

        {result && (
          <section className={`${card} space-y-4`} aria-live="polite" data-testid="exam-result">
            <h2 className="text-2xl font-bold text-[var(--ink)]">{ar ? `نتيجتك: ${result.correct} من ${result.total}` : `Your result: ${result.correct} of ${result.total}`}</h2>
            {result.passed && result.code ? (
              <>
                <p className="text-[var(--ink)] font-semibold">{ar ? 'مبروك، نجحت!' : 'Congratulations, you passed!'}</p>
                <PassportSeals
                  ar={ar}
                  testId="learn-passport"
                  title={ar ? 'جواز وجاهة: أختام المحاور' : 'Wijaha passport: module seals'}
                  items={MODULES.map((m, i) => ({
                    key: m.id,
                    code: String(i + 1),
                    label: tr(locale, m.ar, m.en),
                    stamped: !result.reviewModules.includes(m.id),
                    value: '✓',
                    emptyNote: ar ? 'يُستحسن مراجعته' : 'worth reviewing',
                  }))}
                />
                <div className="wj-sheen" data-testid="cert-sheen">
                  <CertificateSvg svgRef={svgRef} name={name.trim()} correct={result.correct} total={result.total} date={new Date().toISOString().slice(0, 10)} code={result.code} locale={locale} />
                </div>
                <p className="wj-cert-code">{ar ? 'رمز التحقق' : 'Verification code'}: <span className="font-mono" dir="ltr">{result.code}</span></p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimary} onClick={() => svgRef.current && void downloadPng(svgRef.current, 'wijaha-certificate', 1.5)} data-testid="cert-download">
                    <Download className="w-4 h-4" aria-hidden="true" />
                    {ar ? 'نزّل الشهادة PNG' : 'Download certificate PNG'}
                  </button>
                  <Link to={`/verify/${result.code}`} className={btn} data-testid="cert-verify-link">{ar ? 'صفحة التحقق (للمشاركة)' : 'Verification page (to share)'}</Link>
                </div>
                <p className="text-sm text-[var(--ink-2)]">{ar ? 'رابط التحقق يحتوي اسمك ودرجتك؛ شاركه عن قصد.' : 'The verification link contains your name and score; share it deliberately.'}</p>
              </>
            ) : (
              <>
                <p className="text-[var(--ink)]">{ar ? 'لم تبلغ درجة النجاح بعد. راجع هذه المحاور ثم أعد المحاولة:' : 'You have not reached the pass mark yet. Review these modules and retry:'}</p>
                <ul className="list-disc ps-5 text-[var(--ink)]">
                  {result.reviewModules.map((id) => {
                    const m = MODULES.find((x) => x.id === id);
                    return m ? <li key={id}><a href={`#${id}`} className="underline">{tr(locale, m.ar, m.en)}</a></li> : null;
                  })}
                </ul>
                <button type="button" className={btn} onClick={() => { setResult(null); setAnswers({}); window.scrollTo({ top: 0 }); }}>{ar ? 'أعد الاختبار' : 'Retake the exam'}</button>
              </>
            )}
          </section>
        )}
      </Page>
    </AppShell>
  );
}
