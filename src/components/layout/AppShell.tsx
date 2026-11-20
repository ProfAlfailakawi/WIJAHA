import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ClipboardCheck,
  FolderKanban,
  Globe,
  GraduationCap,
  LogOut,
  Menu,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';
import { BRAND } from '../../config/brand';
import { useAuth } from '../../lib/auth-client';
import { useI18n } from '../../lib/i18n';
import { Button, Dialog, OfflineBanner, WijahaEmblem } from '../ui/Primitives';

export function SignInModal() {
  const { t, locale } = useI18n();
  const {
    state,
    signInModalOpen,
    closeSignInModal,
    signInWithGoogle,
    sendMagicCode,
    verifyMagicCode,
    signInDemoAccount,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const demoAccounts = [
    {
      email: 'sara@org-alpha.demo',
      labelAr: 'سارة المنصور — مالكة مؤسسة (باقة الفريق)',
      labelEn: 'Sara Al-Mansour — Org Owner (Team Plan)',
    },
    {
      email: 'noura@individual.demo',
      labelAr: 'نورة العتيبي — مستخدم فردي (الباقة المجانية)',
      labelEn: 'Noura Al-Otaibi — Individual (Free Plan)',
    },
    {
      email: 'yousef@wijaha.demo',
      labelAr: 'د. يوسف الحسني — مراجع مراسم أول',
      labelEn: 'Dr. Yousef Al-Hasani — Senior Reviewer',
    },
    {
      email: 'admin@wijaha.demo',
      labelAr: 'مدير المنصة — حوكمة كاملة وإدارة (Admin)',
      labelEn: 'Platform Admin — Full Governance Console',
    },
  ];

  const handleGoogle = async () => {
    setBusy(true);
    setErrorMsg(null);
    const ok = await signInWithGoogle();
    setBusy(false);
    if (!ok) {
      setErrorMsg(
        locale === 'ar'
          ? 'تعذّر إكمال نافذة Google في هذه البيئة. يمكنك استخدام رمز البريد الإلكتروني.'
          : 'Google popup could not complete here. Please use Email Code sign-in.',
      );
    }
  };

  const handleSendMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setErrorMsg(null);
    const out = await sendMagicCode(email.trim());
    setBusy(false);
    if (!out.ok) {
      setErrorMsg(locale === 'ar' ? 'يرجى التحقق من البريد الإلكتروني.' : 'Please check your email.');
      return;
    }
    setCodeSent(true);
    if (out.devPreviewCode) {
      setDevCode(out.devPreviewCode);
      setCode(out.devPreviewCode);
    }
  };

  const handleVerifyMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setErrorMsg(null);
    const ok = await verifyMagicCode(email.trim(), code.trim());
    setBusy(false);
    if (!ok) {
      setErrorMsg(locale === 'ar' ? 'الرمز غير صحيح أو منتهي الصلاحية.' : 'Invalid or expired code.');
    }
  };

  const handleDemo = async (demoEmail: string) => {
    setBusy(true);
    setErrorMsg(null);
    await signInDemoAccount(demoEmail);
    setBusy(false);
  };

  return (
    <Dialog
      open={signInModalOpen}
      onClose={closeSignInModal}
      title={t.auth.dialogTitle}
      subtitle={t.auth.dialogSubtitle}
    >
      <div className="space-y-5">
        {errorMsg && (
          <p className="text-xs rounded-lg border border-[var(--danger)]/35 bg-[var(--surface-2)] text-[var(--danger)] p-3">
            {errorMsg}
          </p>
        )}

        <Button
          variant="primary"
          className="w-full"
          loading={busy}
          onClick={() => void handleGoogle()}
        >
          {t.auth.googleBtn}
        </Button>

        <div className="border-t border-[var(--line)] pt-4">
          {!codeSent ? (
            <form onSubmit={(e) => void handleSendMagic(e)} className="space-y-3">
              <label className="block text-xs font-medium text-[var(--ink-2)]">
                {t.auth.magicEmailLabel}
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.org"
                  dir="ltr"
                  className="flex-1 min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
                />
                <Button type="submit" variant="secondary" loading={busy}>
                  {t.auth.magicSendBtn}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => void handleVerifyMagic(e)} className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                <span>{email}</span>
                {devCode && (
                  <span className="tabular-nums font-medium text-[var(--gold-ink)]">
                    {locale === 'ar' ? `رمز المعاينة: ${devCode}` : `Preview code: ${devCode}`}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  dir="ltr"
                  className="flex-1 min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3.5 text-sm tracking-widest tabular-nums text-[var(--ink)]"
                />
                <Button type="submit" variant="primary" loading={busy}>
                  {t.auth.magicVerifyBtn}
                </Button>
              </div>
            </form>
          )}
        </div>

        {state.demoLoginEnabled === true && (
          <div className="border-t border-[var(--line)] pt-4">
            <p className="text-xs font-medium text-[var(--ink-3)] mb-2.5">{t.auth.demoTitle}</p>
            <div className="grid grid-cols-1 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDemo(acc.email)}
                  className="min-h-[42px] w-full text-start px-3.5 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] hover:bg-[var(--bg)] transition-colors text-xs text-[var(--ink)] flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="font-medium">
                    {locale === 'ar' ? acc.labelAr : acc.labelEn}
                  </span>
                  <span className="text-[var(--ink-3)] font-mono text-[11px]" dir="ltr">
                    {acc.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function AppShell({
  children,
  minimalHome = false,
}: {
  children: React.ReactNode;
  minimalHome?: boolean;
}) {
  const { locale, setLocale, resolvedDark, setTheme, t } = useI18n();
  const { state, openSignInModal, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdminActor =
    state.actor &&
    ['platform_admin', 'senior_reviewer', 'protocol_reviewer', 'content_editor', 'expert', 'expert_partner'].includes(
      state.actor.platformRole,
    );

  const toggleLanguage = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };

  const toggleTheme = () => {
    setTheme(resolvedDark ? 'light' : 'dark');
  };

  // Short page name for the iPhone Duo clock strip and the two-pane heading.
  const duoTitle = (() => {
    const p = location.pathname;
    const pairs: Array<[string, string]> = [
      ['/practice', t.nav.practice],
      ['/check', t.nav.checkPlan],
      ['/experts', t.nav.experts],
      ['/request', t.nav.experts],
      ['/pricing', t.nav.pricing],
      ['/projects', t.nav.myProjects],
      ['/account', t.nav.account],
      ['/org', t.nav.organization],
      ['/admin', t.nav.admin],
      ['/about', t.footer.about],
      ['/methodology', t.footer.methodology],
      ['/legal/privacy', t.footer.privacy],
      ['/legal/terms', t.footer.terms],
      ['/legal/disclaimer', t.footer.disclaimer],
    ];
    const hit = pairs.find(([prefix]) => p.startsWith(prefix));
    return hit ? hit[1] : locale === 'ar' ? BRAND.nameAr : BRAND.nameEn;
  })();

  // Spec §7: the header carries no menu. Other destinations live in the footer and inside results.
  const navItems = state.authenticated ? [{ to: '/projects', label: t.nav.myProjects }] : [];

  return (
    <div className="wj-shell min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]">
      <a href="#main-content" className="skip-link">
        {t.meta.skipToContent}
      </a>

      <OfflineBanner />

      <header className="wj-header no-print sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo -> Always Home */}
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 text-[var(--ink)] hover:opacity-90 shrink-0 min-h-[44px]"
          >
            <WijahaEmblem className="w-7 h-7" />
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="wj-display text-2xl leading-none">
                {locale === 'ar' ? BRAND.nameAr : BRAND.nameEn}
              </span>
              <span className="hidden sm:inline text-xs font-medium text-[var(--ink-3)] tracking-widest uppercase">
                {locale === 'ar' ? BRAND.nameEn : BRAND.nameAr}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation — Strictly single-line whitespace-nowrap */}
          <nav
            aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'}
            className="hidden md:flex items-center gap-6"
          >
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`text-sm whitespace-nowrap transition-colors py-2 ${
                    active
                      ? 'text-[var(--ink)] font-semibold border-b-2 border-[var(--gold)]'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {isAdminActor && !minimalHome && (
              <Link
                to="/admin"
                className={`text-sm whitespace-nowrap transition-colors py-2 inline-flex items-center gap-1.5 ${
                  location.pathname.startsWith('/admin')
                    ? 'text-[var(--ink)] font-semibold border-b-2 border-[var(--gold)]'
                    : 'text-[var(--gold-ink)] hover:text-[var(--ink)]'
                }`}
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>{t.nav.admin}</span>
              </Link>
            )}
          </nav>

          {/* Right/End Actions — Desktop shows Theme + Lang + Account; Mobile shows ONLY Menu/Account button per Section 8.1 */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                locale === 'ar'
                  ? resolvedDark
                    ? 'التبديل للوضع الفاتح'
                    : 'التبديل للوضع الداكن'
                  : resolvedDark
                    ? 'Switch to light mode'
                    : 'Switch to dark mode'
              }
              className="hidden md:inline-flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            >
              {resolvedDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              className="hidden md:inline-flex min-w-[44px] min-h-[44px] px-2.5 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.nav.switchLang}</span>
            </button>

            {state.authenticated && state.actor ? (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to="/account"
                  className="min-h-[40px] px-3 inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-xs font-medium text-[var(--ink)] whitespace-nowrap"
                >
                  <User className="w-3.5 h-3.5 text-[var(--gold-ink)]" aria-hidden="true" />
                  <span className="max-w-[130px] truncate">{state.actor.name}</span>
                </Link>
              </div>
            ) : (
              <Button
                variant={minimalHome ? 'ghost' : 'secondary'}
                size="sm"
                onClick={() => openSignInModal()}
                className="hidden md:inline-flex"
              >
                {t.nav.signIn}
              </Button>
            )}

            {/* Mobile compact menu trigger (Section 8.1: Mobile header = Logo + Account/Menu only) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label={locale === 'ar' ? 'القائمة والحساب' : 'Menu and account'}
              className="wj-menu-btn md:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="wj-drawer md:hidden border-t border-[var(--line)] bg-[var(--surface)] px-4 py-4 space-y-2 shadow-lg">
            {state.authenticated && state.actor ? (
              <div className="pb-3 mb-2 border-b border-[var(--line)] flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{state.actor.name}</p>
                  <p className="text-xs text-[var(--ink-3)]" dir="ltr">
                    {state.actor.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void signOut();
                  }}
                  className="min-h-[40px] px-3 inline-flex items-center gap-1.5 text-xs text-[var(--danger)] rounded-lg hover:bg-[var(--surface-2)] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.nav.signOut}</span>
                </button>
              </div>
            ) : (
              <div className="pb-3 mb-2 border-b border-[var(--line)]">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openSignInModal();
                  }}
                >
                  {t.nav.signIn}
                </Button>
              </div>
            )}

            {[
              ...(state.authenticated
                ? [
                    { to: '/projects', label: t.nav.myProjects, icon: FolderKanban },
                    { to: '/account', label: t.nav.account, icon: User },
                    { to: '/org', label: t.nav.organization, icon: Building2 },
                  ]
                : []),
              { to: '/practice', label: t.nav.practice },
              { to: '/check', label: t.nav.checkPlan },
              { to: '/experts', label: t.nav.experts },
              { to: '/pricing', label: t.nav.pricing },
              ...(isAdminActor ? [{ to: '/admin', label: t.nav.admin, icon: ShieldCheck }] : []),
            ].map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(item.to);
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg text-start text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] flex items-center gap-2.5 cursor-pointer"
              >
                {item.label}
              </button>
            ))}

            <div className="pt-2 mt-2 border-t border-[var(--line)] flex items-center justify-between gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  toggleLanguage();
                  setMobileMenuOpen(false);
                }}
                className="flex-1"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{t.nav.switchLang}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  toggleTheme();
                }}
                className="flex-1"
              >
                {resolvedDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{resolvedDark ? t.account.themes.light : t.account.themes.dark}</span>
              </Button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="wj-main flex-1 flex flex-col">
        {children}
      </main>

      <footer className="wj-footer no-print border-t border-[var(--line)]/80 bg-[var(--bg)] py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--ink-3)]">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2">
            <Link to="/about" className="hover:text-[var(--ink)] transition-colors">
              {t.footer.about}
            </Link>
            <Link to="/methodology" className="hover:text-[var(--ink)] transition-colors">
              {t.footer.methodology}
            </Link>
            <Link to="/check" className="hover:text-[var(--ink)] transition-colors">
              {t.footer.checkPlan}
            </Link>
            <Link to="/practice" className="hover:text-[var(--ink)] transition-colors">
              {t.footer.practice}
            </Link>
            <Link to="/experts" className="hover:text-[var(--ink)] transition-colors">
              {t.footer.experts}
            </Link>
            <Link to="/pricing" className="hover:text-[var(--ink)] transition-colors">
              {t.footer.pricing}
            </Link>
            <Link to="/legal/privacy" className="hover:text-[var(--ink)] transition-colors">
              {t.footer.privacy}
            </Link>
            <Link to="/legal/terms" className="hover:text-[var(--ink)] transition-colors">
              {t.footer.terms}
            </Link>
            <Link to="/legal/disclaimer" className="hover:text-[var(--ink)] transition-colors">
              {t.footer.disclaimer}
            </Link>
          </div>
          <p className="text-[11px] text-[var(--ink-3)] text-center sm:text-end">
            {locale === 'ar'
              ? `${BRAND.nameAr} · ${BRAND.trademarkStatusNoticeAr}`
              : `${BRAND.nameEn} · ${BRAND.trademarkStatusNoticeEn}`}
          </p>
        </div>
      </footer>

      {/* iPhone Duo only (hidden elsewhere by src/styles/duo.css): the page title for the
          clock strip, one row of destinations with the menu, and a coloured «+» that starts
          a new occasion. In the app it becomes glass capsules; it replaces, never repeats,
          the header menu. */}
      <div className="wj-duo-dock no-print">
        <span className="wj-duo-title">{duoTitle}</span>
        <nav
          className="wj-duo-bar"
          aria-label={locale === 'ar' ? 'شريط التنقل' : 'Navigation bar'}
        >
          {[
            { to: '/practice', label: t.nav.practice, icon: GraduationCap },
            { to: '/check', label: t.nav.checkPlan, icon: ClipboardCheck },
            { to: '/experts', label: t.nav.experts, icon: Users },
          ].map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className="wj-duo-tab"
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className="wj-duo-tab"
            aria-expanded={mobileMenuOpen}
            aria-label={locale === 'ar' ? 'القائمة' : 'Menu'}
            onClick={() => {
              setMobileMenuOpen((v) => !v);
              window.scrollTo({ top: 0 });
            }}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            <span>{locale === 'ar' ? 'القائمة' : 'Menu'}</span>
          </button>
        </nav>
        <Link
          to="/"
          className="wj-duo-new"
          aria-label={locale === 'ar' ? 'مناسبة جديدة' : 'New occasion'}
        >
          <Plus className="w-6 h-6" aria-hidden="true" />
        </Link>
      </div>

      <SignInModal />
    </div>
  );
}
