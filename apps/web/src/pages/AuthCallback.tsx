import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  clearPendingInviteCode,
  linkClientByInviteCode,
  normalizeInviteCode,
  readPendingInviteCode,
} from '@/lib/inviteClient';

export function AuthCallbackPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const authCode = params.get('code');
      const inviteCode = normalizeInviteCode(readPendingInviteCode());

      if (authCode) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
        if (exchangeError) {
          setError('No pudimos completar el inicio de sesión con Google.');
          return;
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('No se recibió la confirmación de Google.');
          return;
        }
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
          <p className="muted" style={{ marginBottom: 20 }}>{error}</p>
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
