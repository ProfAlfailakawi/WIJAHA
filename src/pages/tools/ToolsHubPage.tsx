import React from 'react';
import { Link } from 'react-router-dom';
import { Award, ClipboardList, ShieldCheck, Building2, CalendarClock, Camera, Mic, Radar, Radio, Shapes, Armchair } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { useI18n } from '../../lib/i18n';
import { card, Page, ToolHero } from './ui';

const TOOLS = [
  { to: '/event', icon: ClipboardList, ar: 'ملف الفعالية', en: 'Event file', dAr: 'أدخل فعاليتك مرة واحدة: دعوة وتقويم وجدول حي وفحص تعارض وجاهزية.', dEn: 'Enter your event once: invitation, calendar, live run sheet, clash check and readiness.' },
  { to: '/seating', icon: Armchair, ar: 'مولّد الجلوس', en: 'Seating studio', dAr: 'من قائمة ضيوف Excel إلى مخطط جلوس وبطاقات أسماء.', dEn: 'From an Excel guest list to a seating plan and name cards.' },
  { to: '/occasions', icon: Radar, ar: 'رادار المناسبات', en: 'Occasions radar', dAr: 'أيام شركائك الوطنية والدينية مع تهنئة وتقويم.', dEn: 'Partners’ national and religious days with greetings and a calendar.' },
  { to: '/live', icon: Radio, ar: 'وجاهة مباشر', en: 'Protocol LIVE', dAr: 'رفيق يوم الفعالية: جدول حي وأزرار للطوارئ.', dEn: 'Event-day companion: live run sheet and emergency buttons.' },
  { to: '/voice', icon: Mic, ar: 'محاكاة صوتية', en: 'Voice simulation', dAr: 'تحدّث مع ضيف افتراضي (شيخ، سفير، غاضب) واحصل على تقييم.', dEn: 'Talk to a virtual guest (sheikh, ambassador, upset) and get feedback.' },
  { to: '/photo-check', icon: Camera, ar: 'افحص صورتي', en: 'Check my photo', dAr: 'قاعة أو طاولة أو منصة أو دعوة: قائمة فحص وتعليم الملاحظات على الصورة.', dEn: 'Hall, table, podium or invitation: a checklist with notes pinned on the photo.' },
  { to: '/org-protocol', icon: Building2, ar: 'بروتوكول مؤسستي', en: 'My organisation’s protocol', dAr: 'ارفع دليل مؤسستك واسأله، يبقى في جهازك.', dEn: 'Load your own manual and query it; it stays on your device.' },
  { to: '/learn', icon: Award, ar: 'مسار التعلّم والشهادة', en: 'Learning path and certificate', dAr: 'ستة محاور واختبار، وشهادة قابلة للتحقق.', dEn: 'Six modules, an exam and a verifiable certificate.' },
  { to: '/review', icon: ShieldCheck, ar: 'حالة مراجعة المحتوى', en: 'Content review status', dAr: 'ما اعتُمد وما بقي مسودة، بصدق.', dEn: 'What is approved and what is still draft, honestly.' },
  { to: '/visuals', icon: Shapes, ar: 'المرئيات', en: 'Visuals', dAr: 'مخططات وبطاقات مشاركة وخط زمني جاهزة للتصدير.', dEn: 'Plans, share cards and timelines ready to export.' },
];

export function ToolsHubPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  return (
    <AppShell>
      <Page>
        <ToolHero
          icon={<CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />}
          kicker={ar ? 'الأدوات' : 'Tools'}
          title={ar ? 'أدوات وجاهة العملية' : 'WIJAHA practical tools'}
          sub={ar ? 'كلها مجانية وتعمل في متصفحك؛ بياناتك لا تغادر جهازك ما لم يُذكر خلاف ذلك.' : 'All free and running in your browser; your data stays on your device unless stated otherwise.'}
        />
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map(({ to, icon: Icon, ar: a, en, dAr, dEn }) => (
            <li key={to}>
              <Link to={to} className={`${card} h-full block hover:bg-[var(--surface-2)] transition-colors`} data-testid={`tool-${to.slice(1)}`}>
                <Icon className="w-6 h-6 text-[var(--gold)] mb-3" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[var(--ink)]">{ar ? a : en}</h2>
                <p className="mt-1 text-sm text-[var(--ink-2)] leading-relaxed">{ar ? dAr : dEn}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Page>
    </AppShell>
  );
}
