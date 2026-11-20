import React, { useEffect, useMemo, useState } from 'react';
import { unzipSync, strFromU8 } from 'fflate';
import { Building2, Search, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { useI18n } from '../../lib/i18n';
import { chunkManual, MAX_MANUAL_CHARS, searchManual } from '../../shared/tools/org-manual.ts';
import { btn, btnPrimary, card, input, Page, ToolHero } from './ui';

const KEY = 'wijaha.orgmanual.v1';

function docxToText(buf: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : '';
  return xml
    .replace(/<\/w:p>/g, '\n\n')
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function OrgProtocolPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [manual, setManual] = useState('');
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { text: string; name: string } | null;
      if (v) {
        setManual(v.text);
        setName(v.name);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const save = (text: string, n: string) => {
    setManual(text);
    setName(n);
    try {
      localStorage.setItem(KEY, JSON.stringify({ text, name: n }));
      setMsg('');
    } catch {
      setMsg(ar ? 'تعذّر حفظ الدليل في المتصفح (قد يكون كبيراً). سيعمل حتى إغلاق الصفحة.' : 'Could not save the manual in the browser (it may be large). It works until you close the page.');
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setMsg('');
    try {
      let text = '';
      if (/\.docx$/i.test(f.name)) text = docxToText(await f.arrayBuffer());
      else if (/\.(txt|md)$/i.test(f.name) || f.type.startsWith('text/')) text = await f.text();
      else {
        setMsg(ar ? 'الصيغ المدعومة: ‎.docx و‎.txt و‎.md. حوّل ملف PDF إلى نص أو Word أولاً.' : 'Supported: .docx, .txt, .md. Convert PDFs to text or Word first.');
        return;
      }
      if (text.length > MAX_MANUAL_CHARS) setMsg(ar ? 'الدليل طويل؛ قُصَّ بعد 400 ألف حرف.' : 'The manual is long; trimmed after 400k characters.');
      save(text.slice(0, MAX_MANUAL_CHARS), f.name);
    } catch {
      setMsg(ar ? 'تعذّرت قراءة الملف.' : 'Could not read the file.');
    }
  };

  const chunks = useMemo(() => chunkManual(manual), [manual]);
  const hits = useMemo(() => (asked ? searchManual(chunks, asked) : []), [chunks, asked]);

  return (
    <AppShell>
      <Page>
        <ToolHero
          icon={<Building2 className="w-3.5 h-3.5" aria-hidden="true" />}
          kicker={ar ? 'بروتوكول مؤسستي' : 'My organisation’s protocol'}
          title={ar ? 'اسأل دليل مؤسستك' : 'Ask your own manual'}
          sub={ar ? 'ضع دليل بروتوكول جهتك (Word أو نص)، ثم اسأل بلغتك؛ تظهر لك الفقرات ذات الصلة من دليلك أنت. الدليل يبقى في متصفحك ولا يُرسل لأي جهة.' : 'Load your organisation’s protocol manual (Word or text), then ask in plain language; the relevant passages from your own manual appear. It stays in your browser and is sent nowhere.'}
        />

        <section className={`${card} space-y-4`}>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {ar ? 'ارفع الدليل (.docx / .txt / .md)' : 'Upload the manual (.docx / .txt / .md)'}
            <input type="file" accept=".docx,.txt,.md,text/plain" className="mt-1 block text-[var(--ink)]" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="org-file" />
          </label>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {ar ? 'أو الصق النص هنا' : 'Or paste the text here'}
            <textarea className={`${input} mt-1 min-h-[140px] py-2`} value={manual} onChange={(e) => save(e.target.value.slice(0, MAX_MANUAL_CHARS), name || 'pasted')} data-testid="org-text" />
          </label>
          {msg && <p role="alert" className="text-[var(--c-rose)] font-semibold">{msg}</p>}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-2)]">
            <span data-testid="org-count">{ar ? `${chunks.length} فقرة محفوظة${name ? ` من «${name}»` : ''}` : `${chunks.length} passages${name ? ` from “${name}”` : ''}`}</span>
            {manual && (
              <button type="button" className={btn} onClick={() => { save('', ''); try { localStorage.removeItem(KEY); } catch { /* ignore */ } setAsked(''); }} data-testid="org-clear">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {ar ? 'احذف الدليل من جهازي' : 'Delete the manual from my device'}
              </button>
            )}
          </div>
        </section>

        <section className={`${card} space-y-4`} aria-label={ar ? 'اسأل' : 'Ask'}>
          <form onSubmit={(e) => { e.preventDefault(); setAsked(q); }} className="flex flex-wrap gap-2">
            <label className="flex-1 min-w-[220px] text-sm font-semibold text-[var(--ink)]">
              <span className="sr-only">{ar ? 'سؤالك' : 'Your question'}</span>
              <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'مثال: ما سياسة الهدايا؟' : 'e.g. What is the gift policy?'} data-testid="org-q" />
            </label>
            <button type="submit" className={btnPrimary} disabled={chunks.length === 0 || !q.trim()} data-testid="org-ask">
              <Search className="w-4 h-4" aria-hidden="true" />
              {ar ? 'ابحث في دليلي' : 'Search my manual'}
            </button>
          </form>
          {asked && hits.length === 0 && <p className="text-[var(--ink-2)]" data-testid="org-none">{ar ? 'لم أجد فقرة مطابقة في دليلك. جرّب كلمات أخرى، أو اسأل وجاهة العامة من الصفحة الرئيسية.' : 'No matching passage in your manual. Try other words, or ask general WIJAHA from the home page.'}</p>}
          <ol className="space-y-3" data-testid="org-hits">
            {hits.map((h) => (
              <li key={h.chunk.id} className="rounded-2xl border border-[var(--line)] p-4">
                {h.chunk.heading && <p className="text-sm font-bold text-[var(--c-gold)]">{h.chunk.heading}</p>}
                <p className="text-[var(--ink)] leading-relaxed">{h.chunk.text}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-[var(--ink-2)]">{ar ? 'تُعرض نصوص دليلك كما هي دون إعادة صياغة. إذا تعارض دليل جهتك مع الإرشاد العام فدليل جهتك هو المرجع الداخلي.' : 'Your manual’s text is shown verbatim, not paraphrased. Where your manual conflicts with general guidance, your manual is the internal authority.'}</p>
        </section>
      </Page>
    </AppShell>
  );
}
