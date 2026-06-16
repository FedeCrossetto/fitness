import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/Login';
import { DownloadPage } from '@/pages/Download';
import { DashboardPage } from '@/pages/Dashboard';
import { BrandingPage } from '@/pages/Branding';
import { StudentsPage } from '@/pages/Students';
import { StudentDetailPage } from '@/pages/StudentDetail';
import { RoutinesPage } from '@/pages/Routines';

function Protected(): React.JSX.Element {
  const { session, canManage, loading } = useAuth();
  if (loading) return <div className="center-screen muted">Cargando…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!canManage) {
    return (
      <div className="center-screen">
        <div className="login-box card">
          <h2 className="page-title">Sin acceso</h2>
          <p className="muted">Esta cuenta no tiene rol de entrenador. Pedí acceso al administrador.</p>
        </div>
      </div>
    );
  }
  return <Layout />;
}

function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/descargar" element={<DownloadPage />} />
        <Route element={<Protected />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/branding" element={<BrandingPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/routines" element={<RoutinesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
