import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Gem } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { ShowcaseViewer, type ShowcaseHandle } from '../../components/three/ShowcaseViewer';
import { downloadBlob } from '../../components/visuals/export.ts';
import type { ShowcaseKind } from '../../components/three/showcase.ts';
import { useI18n } from '../../lib/i18n';
import { btn, card, Page, ToolHero } from './ui';

const SCENES: Record<ShowcaseKind, { ar: string; en: string; pointsAr: string[]; pointsEn: string[] }> = {
  table: {
    ar: 'طاولة الطعام الرسمية', en: 'Formal place setting',
    pointsAr: ['الأدوات من الخارج إلى الداخل بترتيب الأطباق: الشوكات على اليسار والسكين والملعقة على اليمين.', 'الكؤوس أعلى السكين من جهة اليمين: كأس الماء ثم كأس المشروب.', 'طبق الخبز الجانبي على اليسار، وبطاقة الاسم أمام الضيف.', 'المنديل مرتب فوق الطبق، والإضاءة بالشموع لا تحجب النظر.'],
    pointsEn: ['Cutlery laid outside-in by course: forks on the left, knife and spoon on the right.', 'Glasses above the knife on the right: water first, then the other glass.', 'Bread plate on the left, place card in front of the guest.', 'The napkin sits on the plate and the candle does not block sightlines.'],
  },
  podium: {
    ar: 'المنصة والأعلام', en: 'Podium and flags',
    pointsAr: ['الأعلام بارتفاع وحجم واحد، ومتماثلة على جانبي المنصة.', 'المنصة في الوسط وخلفها شعار الجهة، ومقاعد الصف الأول محجوزة ببطاقات أسماء مرقّمة.', 'ممر واضح من المدخل إلى المنصة.', 'الأعلام هنا ألوان تجريدية للتوضيح وليست أعلام دول.'],
    pointsEn: ['Flags of equal height and size, symmetric on both sides of the podium.', 'Podium at the centre with the organisation’s logo behind it; the front row is reserved with numbered name cards.', 'A clear aisle from the entrance to the podium.', 'The flags here are abstract colours for illustration, not real states’ flags.'],
  },
};

export function ShowcasePage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [kind, setKind] = useState<ShowcaseKind>('table');
  const [unsupported, setUnsupported] = useState(false);
  const ref = useRef<ShowcaseHandle>(null);
  const s = SCENES[kind];

  return (
    <AppShell>
      <Page>
        <ToolHero
          icon={<Gem className="w-3.5 h-3.5" aria-hidden="true" />}
          kicker={ar ? 'المعرض ثلاثي الأبعاد' : '3D showcase'}
          title={ar ? 'الطاولة والمنصة كما هي في الواقع' : 'The table and the podium, as in real life'}
          sub={ar ? 'دوّر المشهد بإصبعك وقرّب لترى التفاصيل: ترتيب الأدوات والكؤوس، وارتفاع الأعلام وموضع المنصة.' : 'Rotate and zoom to see the details: cutlery and glass layout, flag height and podium placement.'}
        />
        <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 items-start">
          <section className={`${card} space-y-3`}>
            <div className="flex flex-wrap gap-2" role="group" aria-label={ar ? 'المشهد' : 'Scene'}>
              {(['table', 'podium'] as ShowcaseKind[]).map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setUnsupported(false); setKind(k); }} data-testid={`scene-${k}`} className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold cursor-pointer ${kind === k ? 'bg-[var(--primary)] text-[var(--bg)] border-[var(--primary)]' : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)]'}`}>
                  {ar ? SCENES[k].ar : SCENES[k].en}
                </button>
              ))}
            </div>
            {unsupported ? (
              <p role="alert" className="rounded-2xl border border-[var(--c-rose)] p-4 text-[var(--ink)]" data-testid="showcase-fallback">{ar ? 'جهازك لا يدعم العرض ثلاثي الأبعاد؛ استخدم صفحة المرئيات.' : 'Your device does not support 3D; use the Visuals page.'}</p>
            ) : (
              <ShowcaseViewer key={kind} ref={ref} kind={kind} ariaLabel={ar ? 'مشهد ثلاثي الأبعاد' : '3D scene'} onUnsupported={() => setUnsupported(true)} />
            )}
            <button type="button" className={btn} disabled={unsupported} onClick={() => void ref.current?.snapshot().then((b) => downloadBlob(b, `wijaha-${kind}-3d.png`))} data-testid="showcase-png">
              <Camera className="w-4 h-4" aria-hidden="true" />
              {ar ? 'حفظ لقطة PNG' : 'Save PNG snapshot'}
            </button>
          </section>
          <section className={`${card} space-y-3`} aria-live="polite">
            <h2 className="text-2xl font-bold text-[var(--ink)]">{ar ? s.ar : s.en}</h2>
            <ul className="list-disc ps-5 space-y-2 text-[var(--ink)] leading-relaxed">
              {(ar ? s.pointsAr : s.pointsEn).map((p) => <li key={p}>{p}</li>)}
            </ul>
            <p className="text-sm text-[var(--ink-2)]">{ar ? 'مبسّط للتوضيح. الأعراف تختلف بين الجهات؛ المحتوى مسودة تنتظر مراجعة خبير.' : 'Simplified for illustration. Customs vary between organisations; the content is a draft awaiting expert review.'}</p>
            <Link to="/visuals" className={btn}>{ar ? 'المرئيات الثنائية القابلة للتصدير' : 'Exportable 2D visuals'}</Link>
          </section>
        </div>
      </Page>
    </AppShell>
  );
}
