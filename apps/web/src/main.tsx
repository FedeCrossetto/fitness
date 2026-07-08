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
import { PaymentReturnPage } from '@/pages/PaymentReturn';

// Páginas internas: lazy para no inflar el bundle inicial.
const DashboardPage        = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const FoodsPage            = lazy(() => import('@/pages/Foods').then((m) => ({ default: m.FoodsPage })));
const BrandingPage         = lazy(() => import('@/pages/Branding').then((m) => ({ default: m.BrandingPage })));
const ClientsPage          = lazy(() => import('@/pages/Clients').then((m) => ({ default: m.ClientsPage })));
const ClientDetailPage     = lazy(() => import('@/pages/ClientDetail').then((m) => ({ default: m.ClientDetailPage })));
const ProgramLibraryPage   = lazy(() => import('@/pages/ProgramLibrary').then((m) => ({ default: m.ProgramLibraryPage })));
const ProgramEditorPage    = lazy(() => import('@/pages/ProgramEditor').then((m) => ({ default: m.ProgramEditorPage })));
const RoutineEditorPage    = lazy(() => import('@/pages/RoutineEditor').then((m) => ({ default: m.RoutineEditorPage })));
const ExerciseLibraryPage  = lazy(() => import('@/pages/ExerciseLibrary').then((m) => ({ default: m.ExerciseLibraryPage })));
const MessagesPage         = lazy(() => import('@/pages/Messages').then((m) => ({ default: m.MessagesPage })));
const GroupsPage           = lazy(() => import('@/pages/Groups').then((m) => ({ default: m.GroupsPage })));
const GroupDetailPage      = lazy(() => import('@/pages/GroupDetail').then((m) => ({ default: m.GroupDetailPage })));
const PaymentsPage         = lazy(() => import('@/pages/Payments').then((m) => ({ default: m.PaymentsPage })));
const ManagePlansPage      = lazy(() => import('@/pages/ManagePlans').then((m) => ({ default: m.ManagePlansPage })));
const PaymentIntegrationsPage = lazy(() => import('@/pages/PaymentIntegrations').then((m) => ({ default: m.PaymentIntegrationsPage })));
const SettingsPage         = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })));
const AutoMessagesPage     = lazy(() => import('@/pages/AutoMessages').then((m) => ({ default: m.AutoMessagesPage })));
const FormsPage            = lazy(() => import('@/pages/Forms').then((m) => ({ default: m.FormsPage })));
const ConsultationFormPage = lazy(() => import('@/pages/ConsultationForm').then((m) => ({ default: m.ConsultationFormPage })));
const WaiverSettingsPage   = lazy(() => import('@/pages/WaiverSettings').then((m) => ({ default: m.WaiverSettingsPage })));
const NotificationSettingsPage = lazy(() => import('@/pages/NotificationSettings').then((m) => ({ default: m.NotificationSettingsPage })));
const AnnouncementsPage    = lazy(() => import('@/pages/Announcements').then((m) => ({ default: m.AnnouncementsPage })));
const ChallengesPage       = lazy(() => import('@/pages/Challenges').then((m) => ({ default: m.ChallengesPage })));

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
          <Route path="/pago/:result" element={<PaymentReturnPage />} />
          <Route element={<Protected />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/challenges" element={<ChallengesPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/payments/planes" element={<ManagePlansPage />} />
            <Route path="/payments/integraciones" element={<PaymentIntegrationsPage />} />
            <Route path="/programs" element={<ProgramLibraryPage />} />
            <Route path="/programs/:id" element={<ProgramEditorPage />} />
            <Route path="/routines/:id" element={<RoutineEditorPage />} />
            <Route path="/exercises" element={<ExerciseLibraryPage />} />
            <Route path="/routines" element={<Navigate to="/programs" replace />} />
            <Route path="/foods" element={<FoodsPage />} />
            <Route path="/branding" element={<BrandingPage />} />
            <Route path="/scheduling" element={<Navigate to="/" replace />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/auto-messages" element={<AutoMessagesPage />} />
            <Route path="/settings/forms" element={<FormsPage />} />
            <Route path="/settings/forms/:planType" element={<ConsultationFormPage />} />
            <Route path="/settings/waiver" element={<WaiverSettingsPage />} />
            <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
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
