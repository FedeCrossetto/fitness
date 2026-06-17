import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  clearPendingInviteCode,
  linkClientByInviteCode,
  normalizeInviteCode,
  readPendingInviteCode,
} from '@/lib/inviteClient';

/** Completa la sesión OAuth: PKCE (?code=) o tokens en hash (#access_token=). */
async function completeOAuthSession(): Promise<{ ok: true } | { ok: false; message: string }> {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const oauthError = query.get('error_description') ?? query.get('error') ?? hash.get('error_description') ?? hash.get('error');
  if (oauthError) {
    return { ok: false, message: decodeURIComponent(oauthError.replace(/\+/g, ' ')) };
  }

  const authCode = query.get('code');
  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (error) return { ok: false, message: 'No pudimos completar el inicio de sesión con Google.' };
    return { ok: true };
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) return { ok: false, message: 'No pudimos guardar la sesión de Google.' };
    return { ok: true };
  }

  // detectSessionInUrl puede haberla establecido ya al cargar el cliente
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return { ok: true };

  return {
    ok: false,
    message: 'No se recibió la confirmación de Google. Verificá en Supabase → Authentication → URL Configuration que esté agregada: https://reset-fitness.vercel.app/auth/callback',
  };
}

export function AuthCallbackPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const inviteCode = normalizeInviteCode(readPendingInviteCode());

      const auth = await completeOAuthSession();
      if (!auth.ok) {
        setError(auth.message);
        return;
      }

      if (inviteCode) {
        const link = await linkClientByInviteCode(inviteCode);
        clearPendingInviteCode();
        if (!link.ok) {
          setError(link.message);
          return;
        }
        navigate(`/unirse?code=${encodeURIComponent(inviteCode)}&joined=1`, { replace: true });
        return;
      }

      navigate('/unirse', { replace: true });
    })();
  }, [navigate]);

  if (error) {
    return (
      <div className="center-screen">
        <div className="login-box card" style={{ textAlign: 'center' }}>
          <h2 className="page-title">Error al registrarse</h2>
          <p className="muted" style={{ marginBottom: 20, lineHeight: 1.5 }}>{error}</p>
          <button className="btn secondary" onClick={() => navigate(-1)}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="center-screen">
      <p className="muted">Conectando con Google…</p>
    </div>
  );
}
