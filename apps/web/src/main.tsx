import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { I18nProvider } from '@/hooks/useTranslation';
import { ToastProvider } from '@/hooks/useToast';
import { FullScreenLoader } from '@/components/ui';
import { Layout } from '@/components/Layout';
// Pre-auth y guard: eager (se necesitan en el primer render).
import { LoginPage } from '@/pages/Login';
import { JoinPage } from '@/pages/Join';
import { AuthCallbackPage, OAuthRedirectGuard } from '@/pages/AuthCallback';
import { AuthMobileCallbackPage } from '@/pages/AuthMobileCallback';
import { DownloadPage } from '@/pages/Download';

// Páginas internas: lazy para no inflar el bundle inicial.
const DashboardPage        = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const BrandingPage         = lazy(() => import('@/pages/Branding').then((m) => ({ default: m.BrandingPage })));
const StudentsPage         = lazy(() => import('@/pages/Students').then((m) => ({ default: m.StudentsPage })));
const StudentDetailPage    = lazy(() => import('@/pages/StudentDetail').then((m) => ({ default: m.StudentDetailPage })));
const RoutinesPage         = lazy(() => import('@/pages/Routines').then((m) => ({ default: m.RoutinesPage })));
const MessagesPage         = lazy(() => import('@/pages/Messages').then((m) => ({ default: m.MessagesPage })));
const GroupsPage           = lazy(() => import('@/pages/Groups').then((m) => ({ default: m.GroupsPage })));
const ChallengesPage       = lazy(() => import('@/pages/Challenges').then((m) => ({ default: m.ChallengesPage })));
const PaymentsPage         = lazy(() => import('@/pages/Payments').then((m) => ({ default: m.PaymentsPage })));
const SchedulingPage       = lazy(() => import('@/pages/Scheduling').then((m) => ({ default: m.SchedulingPage })));
const SettingsPage         = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })));
const AutoMessagesPage     = lazy(() => import('@/pages/AutoMessages').then((m) => ({ default: m.AutoMessagesPage })));
const ConsultationFormPage = lazy(() => import('@/pages/ConsultationForm').then((m) => ({ default: m.ConsultationFormPage })));
const WaiverSettingsPage   = lazy(() => import('@/pages/WaiverSettings').then((m) => ({ default: m.WaiverSettingsPage })));
const AnnouncementsPage    = lazy(() => import('@/pages/Announcements').then((m) => ({ default: m.AnnouncementsPage })));
const AddOnsPage           = lazy(() => import('@/pages/AddOns').then((m) => ({ default: m.AddOnsPage })));

function Protected(): React.JSX.Element {
  const { session, canManage, loading, signOut, role } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!canManage) {
    if (role === 'client') {
      return <Navigate to="/descargar" replace />;
    }
    return (
      <div className="center-screen">
        <div className="login-box card" style={{ textAlign: 'center' }}>
          <button
            onClick={() => void signOut()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}
          >
            ← Volver
          </button>
          <h2 className="page-title">Sin acceso</h2>
          <p className="muted" style={{ marginBottom: 24 }}>
            Esta cuenta no tiene rol de entrenador. Iniciá sesión con una cuenta de entrenador.
          </p>
          <button className="btn" style={{ width: '100%' }} onClick={() => void signOut()}>
            Usar otra cuenta
          </button>
        </div>
      </div>
    );
  }
  return <Layout />;
}

function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <OAuthRedirectGuard />
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/descargar" element={<DownloadPage />} />
          <Route path="/unirse" element={<JoinPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/mobile-callback" element={<AuthMobileCallbackPage />} />
          <Route element={<Protected />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/challenges" element={<ChallengesPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/students/:id" element={<StudentDetailPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/routines" element={<RoutinesPage />} />
            <Route path="/branding" element={<BrandingPage />} />
            <Route path="/scheduling" element={<SchedulingPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/add-ons" element={<AddOnsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/auto-messages" element={<AutoMessagesPage />} />
            <Route path="/settings/consultation-form" element={<ConsultationFormPage />} />
            <Route path="/settings/waiver" element={<WaiverSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  </StrictMode>
);
