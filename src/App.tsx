import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './lib/auth-client';
import { I18nProvider, useI18n } from './lib/i18n';
import { AdminPage } from './pages/AdminPage';
import { CheckPlanPage } from './pages/CheckPlanPage';
import {
  ExpertDetailPage,
  ExpertsListPage,
  ServiceRequestPage,
} from './pages/ExpertsPage';
import { HomePage } from './pages/HomePage';
import {
  PracticeListPage,
  SimulationReportPage,
  SimulationRunnerPage,
} from './pages/PracticePage';
import {
  AccountPage,
  InviteAcceptPage,
  OrgPage,
  PricingPage,
} from './pages/PricingAndAccountPages';
import {
  ProjectsListPage,
  ProjectWorkspacePage,
  SharedProjectPage,
} from './pages/ProjectsPage';
import { ResultPage } from './pages/ResultPage';
import {
  AboutPage,
  DevComponentsPage,
  LegalPage,
  MethodologyPage,
  NotFoundPage,
} from './pages/StaticTrustPages';

/**
 * Supports optional /ar/* and /en/* locale prefixes cleanly while keeping canonical paths crisp
 */
function LocalePrefixRedirect() {
  const location = useLocation();
  const { setLocale } = useI18n();
  const seg = location.pathname.split('/')[1];

  useEffect(() => {
    if (seg === 'ar' || seg === 'en') {
      setLocale(seg);
    }
  }, [seg, setLocale]);

  if (seg === 'ar' || seg === 'en') {
    const rest = location.pathname.replace(/^\/(ar|en)/, '') || '/';
    return <Navigate to={`${rest}${location.search}`} replace />;
  }
  return <NotFoundPage />;
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/r/:resultId" element={<ResultPage />} />

            <Route path="/projects" element={<ProjectsListPage />} />
            <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
            <Route path="/share/:token" element={<SharedProjectPage />} />

            <Route path="/practice" element={<PracticeListPage />} />
            <Route path="/practice/:scenarioId" element={<SimulationRunnerPage />} />
            <Route path="/practice/report/:runId" element={<SimulationReportPage />} />

            <Route path="/check" element={<CheckPlanPage />} />

            <Route path="/experts" element={<ExpertsListPage />} />
            <Route path="/experts/:slug" element={<ExpertDetailPage />} />
            <Route path="/request/:serviceId" element={<ServiceRequestPage />} />

            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/org" element={<OrgPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />

            <Route path="/about" element={<AboutPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="/legal/terms" element={<LegalPage kind="terms" />} />
            <Route path="/legal/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/legal/disclaimer" element={<LegalPage kind="disclaimer" />} />
            <Route path="/dev/components" element={<DevComponentsPage />} />

            <Route path="/admin/*" element={<AdminPage />} />

            <Route path="/ar/*" element={<LocalePrefixRedirect />} />
            <Route path="/en/*" element={<LocalePrefixRedirect />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
