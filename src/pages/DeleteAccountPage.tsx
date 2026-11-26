import React from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useI18n } from '../lib/i18n';

// Public page required by Google Play's account-deletion policy.
// It must work without signing in and describe the steps and what is deleted or kept.
export function DeleteAccountPage() {
  const { locale } = useI18n();
  const ar = locale !== 'en';
  return (
    <AppShell>
      <main dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-2xl px-5 py-10 space-y-6 leading-8">
        <h1 className="text-3xl font-bold">{ar ? 'حذف حسابك في وجاهة' : 'Delete your WIJAHA account'}</h1>
        <p>
          {ar
            ? 'ينطبق هذا على موقع وجاهة وتطبيق «وجاهة | WIJAHA» على Google Play وApp Store، ويديرهما SKY GATE EDUCATIONAL CONSULTING COMPANY.'
            : 'This applies to the WIJAHA website and the “وجاهة | WIJAHA” app on Google Play and the App Store, operated by SKY GATE EDUCATIONAL CONSULTING COMPANY.'}
        </p>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">{ar ? 'خطوات الحذف' : 'How to delete'}</h2>
          <ol className="list-decimal ps-6 space-y-1">
            <li>{ar ? 'سجّل الدخول في التطبيق أو الموقع.' : 'Sign in on the app or website.'}</li>
            <li>
              {ar ? 'افتح صفحة ' : 'Open '}
              <Link className="underline" to="/account">{ar ? 'الحساب' : 'Account'}</Link>
              {ar ? '.' : '.'}
            </li>
            <li>{ar ? 'اضغط «حذف الحساب» ثم أكّد.' : 'Tap “Delete account” and confirm.'}</li>
          </ol>
          <p>
            {ar
              ? 'لا تستطيع الدخول؟ راسلنا من بريد حسابك على info@skygateeducation.com بعنوان «حذف حساب وجاهة»، وسننفّذ الطلب خلال 14 يومًا.'
              : 'Can’t sign in? Email info@skygateeducation.com from your account’s address with the subject “Delete WIJAHA account” and we will complete it within 14 days.'}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">{ar ? 'ما يُحذف ومتى' : 'What is deleted, and when'}</h2>
          <p>
            {ar
              ? 'يُوقف الحساب فورًا، ويمكن استرجاعه خلال 14 يومًا. بعد 14 يومًا يُحذف نهائيًا: الاسم والبريد ومعرّف المستخدم، ومساحتك الشخصية ومشاريعك وإصداراتها، وأسئلتك ونتائجها، والمحاكاة ونتائجها، والملاحظات وطلبات الخبراء وسجل التصدير.'
              : 'Your account is disabled immediately and can be recovered for 14 days. After 14 days we permanently delete your name, email and user ID, your personal workspace and projects with their versions, your questions and results, simulations and scores, feedback, expert requests and export history.'}
          </p>
          <h2 className="text-xl font-bold">{ar ? 'ما نحتفظ به' : 'What we keep'}</h2>
          <p>
            {ar
              ? 'سجلات الدفع والفواتير، للمدة التي يفرضها القانون والمحاسبة، وسجلات الأمان المجهولة الضرورية لحماية الخدمة. المشاريع داخل مؤسسة يملكها غيرك تبقى لدى تلك المؤسسة.'
              : 'Payment and invoice records, for as long as accounting law requires, and security audit logs needed to protect the service. Projects inside an organisation owned by someone else stay with that organisation.'}
          </p>
        </section>

        <p>
          <Link className="underline" to="/legal/privacy">{ar ? 'سياسة الخصوصية' : 'Privacy policy'}</Link>
        </p>
      </main>
    </AppShell>
  );
}
