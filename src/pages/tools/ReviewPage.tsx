import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { useI18n } from '../../lib/i18n';
import { card, Page, ToolHero } from './ui';

type Status = 'approved' | 'draft';
const ROWS: Array<{ ar: string; en: string; status: Status; noteAr: string; noteEn: string }> = [
  { ar: 'قواعد المعرفة في نتائج البحث', en: 'Knowledge rules behind search results', status: 'approved', noteAr: 'اعتمدها مالك المنصة بصفته الخبير، ولكل قاعدة سجل مراجعة ومصادر. لم تراجعها جهة خارجية مستقلة.', noteEn: 'Approved by the platform owner acting as the expert, each with a review record and sources. Not reviewed by an independent external party.' },
  { ar: 'أسئلة الاختبار والمحاور (التعلّم والشهادة)', en: 'Exam questions and modules (learning and certificate)', status: 'draft', noteAr: 'مسودة كتبتها أداة ذكاء اصطناعي، تنتظر مراجعة خبير بروتوكول.', noteEn: 'AI-drafted, awaiting review by a protocol expert.' },
  { ar: 'خطوات الطوارئ وقوالب جداول الفعاليات (وجاهة مباشر)', en: 'Emergency steps and run-sheet templates (Protocol LIVE)', status: 'draft', noteAr: 'مسودة تنتظر مراجعة خبير؛ تُعرض كإرشاد استرشادي.', noteEn: 'Draft awaiting expert review; shown as advisory guidance.' },
  { ar: 'ترتيب الأسبقية في مولّد الجلوس', en: 'Precedence ordering in the seating studio', status: 'draft', noteAr: 'اقتراح قائم على الألقاب، ويجب تأكيده مع مراسم الجهة المضيفة.', noteEn: 'A title-based suggestion; must be confirmed with the host’s protocol office.' },
  { ar: 'مناسبات الرادار وتواريخها', en: 'Radar occasions and their dates', status: 'draft', noteAr: 'التواريخ الهجرية تقريبية وتاريخ واحد للجزائر لم يُتحقق منه.', noteEn: 'Hijri dates are approximate and one Algerian date is unverified.' },
  { ar: 'قوائم فحص الصور وشخصيات المحاكاة', en: 'Photo checklists and simulation personas', status: 'draft', noteAr: 'مسودة تنتظر مراجعة خبير.', noteEn: 'Draft awaiting expert review.' },
];

export function ReviewPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  return (
    <AppShell>
      <Page>
        <ToolHero icon={<ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />} kicker={ar ? 'الشفافية' : 'Transparency'} title={ar ? 'حالة مراجعة المحتوى' : 'Content review status'} sub={ar ? 'نبيّن بصدق ما راجعه خبير وما لم يُراجَع بعد. لا ندّعي اعتماداً لم يحدث.' : 'We state honestly what an expert has reviewed and what has not been reviewed yet. We do not claim approval that has not happened.'} />
        <ul className="space-y-3" data-testid="review-list">
          {ROWS.map((r) => (
            <li key={r.en} className={`${card} flex flex-wrap items-start gap-3`}>
              <span className={`rounded-full px-3 py-1 text-sm font-bold border ${r.status === 'approved' ? 'border-[var(--c-teal)] text-[var(--c-teal)]' : 'border-[var(--c-gold)] text-[var(--c-gold)]'}`}>
                {r.status === 'approved' ? (ar ? 'معتمد' : 'Approved') : ar ? 'مسودة' : 'Draft'}
              </span>
              <div className="flex-1 min-w-[220px]">
                <h2 className="font-bold text-[var(--ink)]">{ar ? r.ar : r.en}</h2>
                <p className="text-[var(--ink-2)]">{ar ? r.noteAr : r.noteEn}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[var(--ink)]">
          {ar ? 'وجدت خطأً أو لديك تصحيح؟ ' : 'Found a mistake or have a correction? '}
          <a className="underline" href="https://github.com/ProfAlfailakawi/WIJAHA/issues/new" target="_blank" rel="noopener noreferrer">{ar ? 'أبلغنا عبر GitHub' : 'Tell us on GitHub'}</a>
        </p>
      </Page>
    </AppShell>
  );
}
