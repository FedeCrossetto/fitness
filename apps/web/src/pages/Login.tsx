import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DEFAULT_APP_NAME } from '@reset-fitness/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { FullScreenLoader } from '@/components/ui';

export function LoginPage(): React.JSX.Element {
  const { session, loading } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mientras resuelve auth (o carga el perfil tras login) mostramos loader, no el form.
  if (loading) return <FullScreenLoader />;
  if (session) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError('Email o contraseña incorrectos.');
    setSubmitting(false);
  };

  return (
    <div className="center-screen">
      <form className="login-box card" onSubmit={(e) => void onSubmit(e)}>
        <img src="/logo_app_sin_fondo_cuadrado_1024.png" alt={DEFAULT_APP_NAME} className="login-logo" />
        <h1 className="page-title">{DEFAULT_APP_NAME}</h1>
        <p className="page-sub">{t.dashboard.trainer_panel}</p>
        {error ? <div className="toast error">{error}</div> : null}
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
