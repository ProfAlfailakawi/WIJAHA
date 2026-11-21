import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, PersonStanding, XCircle } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PostureViewer, type PostureHandle } from '../../components/three/PostureViewer';
import { downloadBlob } from '../../components/visuals/export.ts';
import { tr } from '../../components/visuals/svg-kit.tsx';
import { useI18n } from '../../lib/i18n';
import { POSE_INFO } from '../../shared/tools/poses.ts';
import { btn, card, Page, ToolHero } from './ui';

export function PosturePage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [id, setId] = useState(POSE_INFO[0].id);
  const [unsupported, setUnsupported] = useState(false);
  const ref = useRef<PostureHandle>(null);
  const idx = POSE_INFO.findIndex((p) => p.id === id);
  const info = POSE_INFO[idx];
  const go = (d: number) => setId(POSE_INFO[(idx + d + POSE_INFO.length) % POSE_INFO.length].id);

  return (
    <AppShell>
      <Page>
        <ToolHero
          icon={<PersonStanding className="w-3.5 h-3.5" aria-hidden="true" />}
          kicker={ar ? 'لغة الجسد' : 'Body language'}
          title={ar ? 'شاهد الوضعية الصحيحة بثلاثة أبعاد' : 'See the right posture in 3D'}
          sub={ar ? 'مجسم يدور بإصبعك: الوقفة والمصافحة والجلوس الرسمي وجلسة المجلس، مع ما يجب تجنبه. اسحب للتدوير وقرّب بالقرص.' : 'A figure you can rotate: the stance, handshake, formal seating and majlis seating, plus what to avoid. Drag to rotate, pinch to zoom.'}
        />
        <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 items-start">
          <section className={`${card} space-y-3`} aria-label={ar ? 'المجسم' : 'Figure'}>
            {unsupported ? (
              <p role="alert" className="rounded-2xl border border-[var(--c-rose)] p-4 text-[var(--ink)]" data-testid="posture-fallback">
                {ar ? 'متصفحك أو جهازك لا يدعم العرض ثلاثي الأبعاد (WebGL). اقرأ وصف الوضعية على الجانب.' : 'Your browser or device does not support 3D (WebGL). Read the pose description beside it.'}
              </p>
            ) : (
              <PostureViewer ref={ref} pose={id} ariaLabel={ar ? 'مجسم ثلاثي الأبعاد لوضعية الجسد' : '3D figure showing the body posture'} onUnsupported={() => setUnsupported(true)} />
            )}
            <div className="flex flex-wrap gap-2 justify-between">
              <div className="flex gap-2">
                <button type="button" className={btn} onClick={() => go(-1)} aria-label={ar ? 'الوضعية السابقة' : 'Previous pose'} data-testid="pose-prev">
                  {ar ? <ArrowRight className="w-4 h-4" aria-hidden="true" /> : <ArrowLeft className="w-4 h-4" aria-hidden="true" />}
                </button>
                <button type="button" className={btn} onClick={() => go(1)} aria-label={ar ? 'الوضعية التالية' : 'Next pose'} data-testid="pose-next">
                  {ar ? <ArrowLeft className="w-4 h-4" aria-hidden="true" /> : <ArrowRight className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
              <button type="button" className={btn} disabled={unsupported} onClick={() => void ref.current?.snapshot().then((b) => downloadBlob(b, `wijaha-${id}.png`))} data-testid="pose-png">
                <Camera className="w-4 h-4" aria-hidden="true" />
                {ar ? 'حفظ لقطة PNG' : 'Save PNG snapshot'}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <div className={`${card} space-y-2`} aria-live="polite" data-testid="pose-info">
              <p className={`inline-flex items-center gap-2 text-sm font-bold ${info.verdict === 'do' ? 'text-[var(--c-teal)]' : 'text-[var(--c-rose)]'}`}>
                {info.verdict === 'do' ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                {info.verdict === 'do' ? (ar ? 'الصحيح' : 'Recommended') : ar ? 'يُتجنَّب' : 'Avoid'}
              </p>
              <h2 className="text-2xl font-bold text-[var(--ink)]">{tr(locale, info.ar, info.en)}</h2>
              <p className="text-[var(--ink)] leading-relaxed">{ar ? info.tipAr : info.tipEn}</p>
            </div>
            <ul className="grid grid-cols-1 gap-2" aria-label={ar ? 'الوضعيات' : 'Poses'}>
              {POSE_INFO.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setId(p.id)} aria-pressed={p.id === id} data-testid={`pose-${p.id}`}
                    className={`w-full min-h-[44px] text-start rounded-xl border px-3.5 py-2 text-sm font-semibold cursor-pointer ${p.id === id ? 'border-[var(--gold)] bg-[var(--surface-2)] text-[var(--ink)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]'}`}>
                    {tr(locale, p.ar, p.en)}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-sm text-[var(--ink-2)]">{ar ? 'المجسم مبسّط للتوضيح. الأعراف تختلف من بلد لآخر؛ المحتوى مسودة تنتظر مراجعة خبير بروتوكول.' : 'The figure is simplified for clarity. Customs vary by country; the content is a draft awaiting protocol-expert review.'}</p>
          </section>
        </div>
      </Page>
    </AppShell>
  );
}
