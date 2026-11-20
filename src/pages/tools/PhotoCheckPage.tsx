import React, { useRef, useState } from 'react';
import { Camera, Download, MapPin } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { downloadBlob } from '../../components/visuals/export.ts';
import { tr } from '../../components/visuals/svg-kit.tsx';
import { useI18n } from '../../lib/i18n';
import { CHECKLISTS, PHOTO_KINDS, scoreChecks, type Mark, type PhotoKind } from '../../shared/tools/photo-checklists.ts';
import { btn, btnPrimary, card, Page, ToolHero } from './ui';

interface Pin {
  x: number;
  y: number;
  item: string;
}

const MAX_SIDE = 1600;

function loadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function PhotoCheckPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [kind, setKind] = useState<PhotoKind>('hall');
  const [src, setSrc] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const imgRef = useRef<HTMLImageElement | null>(null);

  const items = CHECKLISTS[kind];
  const result = scoreChecks(kind, marks);
  const mark = (id: string, m: Mark) => {
    setMarks((x) => ({ ...x, [id]: m }));
    if (m === 'bad' && src) setPinFor(id);
    else if (pinFor === id) setPinFor(null);
  };

  const onFile = async (f: File | undefined) => {
    setError('');
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 15 * 1024 * 1024) {
      setError(ar ? 'اختر صورة JPG أو PNG أو WebP بحجم أقل من 15 ميغابايت.' : 'Choose a JPG, PNG or WebP image under 15 MB.');
      return;
    }
    try {
      setSrc(await loadImage(f));
      setPins([]);
    } catch {
      setError(ar ? 'تعذّر فتح الصورة.' : 'Could not open the image.');
    }
  };

  const place = (e: React.MouseEvent<HTMLElement>) => {
    if (!pinFor || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPins((p) => [...p.filter((q) => q.item !== pinFor), { x, y, item: pinFor }]);
    setPinFor(null);
  };

  const exportPng = async () => {
    if (!src) return;
    const img = new Image();
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad();
      img.src = src;
    });
    const bad = result.bad;
    const strip = 60 + bad.length * 44;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height + strip;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0a1330';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0);
    const r = Math.max(16, img.width / 45);
    pins.forEach((p) => {
      const n = bad.findIndex((b) => b.id === p.item) + 1;
      if (!n) return;
      g.beginPath();
      g.arc((p.x / 100) * img.width, (p.y / 100) * img.height, r, 0, Math.PI * 2);
      g.fillStyle = '#e5484d';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#fff';
      g.stroke();
      g.fillStyle = '#fff';
      g.font = `bold ${r * 1.1}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), (p.x / 100) * img.width, (p.y / 100) * img.height);
    });
    g.fillStyle = '#fff';
    g.font = '28px sans-serif';
    g.textBaseline = 'alphabetic';
    g.textAlign = ar ? 'right' : 'left';
    g.direction = ar ? 'rtl' : 'ltr';
    const x = ar ? c.width - 24 : 24;
    g.fillText(`WIJAHA — ${tr(locale, 'ملاحظات الفحص', 'Review notes')}: ${result.score}%`, x, img.height + 38);
    bad.forEach((b, i) => g.fillText(`${i + 1}. ${tr(locale, b.ar, b.en)}`, x, img.height + 38 + 40 * (i + 1)));
    c.toBlob((b) => b && downloadBlob(b, 'wijaha-photo-review.png'), 'image/png');
  };

  const seg = (active: boolean) =>
    `min-h-[40px] px-3 rounded-lg border text-sm font-semibold cursor-pointer ${active ? 'bg-[var(--primary)] text-[var(--bg)] border-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--ink-2)] border-[var(--line)]'}`;

  return (
    <AppShell>
      <Page>
        <ToolHero
          icon={<Camera className="w-3.5 h-3.5" aria-hidden="true" />}
          kicker={ar ? 'افحص صورتي' : 'Check my photo'}
          title={ar ? 'افحص قاعتك أو طاولتك أو دعوتك' : 'Review your hall, table or invitation'}
          sub={ar ? 'ارفع الصورة وافحصها ببنود جاهزة؛ علّم الملاحظات على الصورة نفسها ونزّلها. الصورة تبقى في جهازك ولا تُرفع إلى أي خادم.' : 'Load the photo and review it against ready checklist items; pin notes on the picture and download it. The photo stays on your device and is never uploaded.'}
        />

        <section className={`${card} space-y-4`}>
          <div className="flex flex-wrap gap-2" role="group" aria-label={ar ? 'نوع الصورة' : 'Photo type'}>
            {PHOTO_KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} className={seg(kind === k.id)} onClick={() => { setKind(k.id); setMarks({}); setPins([]); setPinFor(null); }} data-testid={`kind-${k.id}`}>
                {tr(locale, k.ar, k.en)}
              </button>
            ))}
          </div>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {ar ? 'اختر صورة' : 'Choose an image'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-[var(--ink)]" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="photo-file" />
          </label>
          {error && <p role="alert" className="text-[var(--c-rose)] font-semibold">{error}</p>}
        </section>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <section className={`${card} space-y-3`} aria-label={ar ? 'الصورة' : 'Photo'}>
            {src ? (
              <>
                {pinFor && <p className="text-sm font-semibold text-[var(--c-gold)]" role="status">{ar ? 'انقر على الصورة لتحديد موضع الملاحظة.' : 'Click the photo to place the note.'}</p>}
                <div className="relative inline-block max-w-full" onClick={place} style={{ cursor: pinFor ? 'crosshair' : 'default' }} data-testid="photo-stage">
                  <img ref={imgRef} src={src} alt={ar ? 'الصورة المرفوعة للفحص' : 'Photo being reviewed'} className="max-w-full h-auto rounded-xl" draggable={false} />
                  {pins.map((p) => {
                    const n = result.bad.findIndex((b) => b.id === p.item) + 1;
                    return n ? (
                      <span key={p.item} className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#e5484d] text-white text-sm font-bold flex items-center justify-center border-2 border-white" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                        {n}
                      </span>
                    ) : null;
                  })}
                </div>
                <button type="button" className={btnPrimary} onClick={() => void exportPng()} data-testid="photo-export">
                  <Download className="w-4 h-4" aria-hidden="true" />
                  {ar ? 'نزّل الصورة مع الملاحظات' : 'Download photo with notes'}
                </button>
              </>
            ) : (
              <p className="text-[var(--ink-2)]">{ar ? 'لم تُختر صورة بعد. يمكنك استخدام القائمة دون صورة.' : 'No photo yet. You can still use the checklist without one.'}</p>
            )}
          </section>

          <section className={`${card} space-y-3`} aria-label={ar ? 'قائمة الفحص' : 'Checklist'}>
            <p className="text-sm text-[var(--ink-2)]">{ar ? 'النتيجة' : 'Score'}: <strong className="text-[var(--ink)]" data-testid="photo-score">{result.score}%</strong> ({result.answered}/{result.total})</p>
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.id} className="rounded-2xl border border-[var(--line)] p-3">
                  <p className="font-semibold text-[var(--ink)]">{tr(locale, it.ar, it.en)}</p>
                  <p className="text-sm text-[var(--ink-2)]">{tr(locale, it.whyAr, it.whyEn)}</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={tr(locale, it.ar, it.en)}>
                    {(['ok', 'bad', 'na'] as Mark[]).map((m) => (
                      <button key={m} type="button" aria-pressed={marks[it.id] === m} className={seg(marks[it.id] === m)} onClick={() => mark(it.id, m)} data-testid={`mark-${it.id}-${m}`}>
                        {m === 'ok' ? (ar ? 'سليم' : 'OK') : m === 'bad' ? (ar ? 'خطأ' : 'Problem') : ar ? 'لا ينطبق' : 'N/A'}
                      </button>
                    ))}
                    {marks[it.id] === 'bad' && src && (
                      <button type="button" className={btn} onClick={() => setPinFor(it.id)}>
                        <MapPin className="w-4 h-4" aria-hidden="true" />
                        {ar ? 'حدّد الموضع' : 'Pin location'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-[var(--ink-2)]">{ar ? 'الفحص يدوي بحكمك أنت؛ لا يحلّل الصورة آلياً. استشر مراسم الجهة في الحالات الحساسة.' : 'The review is manual and based on your judgement; the photo is not analysed automatically. Consult the host’s protocol office on sensitive matters.'}</p>
          </section>
        </div>
      </Page>
    </AppShell>
  );
}
