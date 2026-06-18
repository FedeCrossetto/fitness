import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  clearPendingInviteCode,
  ensureClientLinked,
  normalizeInviteCode,
  readPendingInviteCode,
  savePendingInviteCode,
} from '@/lib/inviteClient';

async function waitForSession(maxMs = 2500): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
    await new Promise((r) => setTimeout(r, 80));
  }
  return false;
}

/** Completa la sesión OAuth: PKCE (?code=) o tokens en hash (#access_token=). */
async function completeOAuthSession(): Promise<{ ok: true } | { ok: false; message: string }> {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const oauthError = query.get('error_description') ?? query.get('error') ?? hash.get('error_description') ?? hash.get('error');
  if (oauthError) {
    return { ok: false, message: decodeURIComponent(oauthError.replace(/\+/g, ' ')) };
  }

  const { data: { session: existing } } = await supabase.auth.getSession();
  if (existing) return { ok: true };

  const authCode = query.get('code');
  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (!error) return { ok: true };

    if (await waitForSession()) return { ok: true };

    return {
      ok: false,
      message: 'No pudimos completar el inicio de sesión con Google. Intentá de nuevo.',
    };
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (!error) return { ok: true };
    if (await waitForSession()) return { ok: true };
    return { ok: false, message: 'No pudimos guardar la sesión de Google.' };
  }

  if (await waitForSession()) return { ok: true };

  return {
    ok: false,
    message: 'No se recibió la confirmación de Google. Verificá en Supabase → Authentication → URL Configuration que esté agregada: https://reset-fitness.vercel.app/auth/callback',
  };
}

export function AuthCallbackPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    void (async () => {
      const inviteFromUrl = normalizeInviteCode(params.get('invite'));
      if (inviteFromUrl) savePendingInviteCode(inviteFromUrl);

      const inviteCode = normalizeInviteCode(readPendingInviteCode());

      const auth = await completeOAuthSession();
      const hasSession = auth.ok || await waitForSession(500);

      if (!hasSession) {
        setError(auth.ok ? 'No pudimos iniciar sesión.' : auth.message);
        return;
      }

      setAccountCreated(true);

      if (inviteCode) {
        const link = await ensureClientLinked(inviteCode);
        clearPendingInviteCode();
        if (!link.ok) {
          setError(
            'Tu cuenta se creó correctamente, pero no pudimos vincularla al entrenador. '
            + 'Volvé a abrir el link de invitación o pedile ayuda a tu entrenador.',
          );
          return;
        }
        navigate(`/unirse?code=${encodeURIComponent(inviteCode)}&joined=1&via=google`, { replace: true });
        return;
      }

      navigate('/descargar', { replace: true });
    })();
  }, [navigate, params]);

  if (error) {
    return (
      <div className="center-screen">
        <div className="login-box card" style={{ textAlign: 'center', maxWidth: 420 }}>
          <h2 className="page-title">{accountCreated ? 'Cuenta creada' : 'Error al registrarse'}</h2>
          <p className="muted" style={{ marginBottom: 20, lineHeight: 1.55 }}>{error}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {accountCreated ? (
              <button
                className="btn"
                onClick={() => {
                  const code = normalizeInviteCode(readPendingInviteCode() ?? params.get('invite'));
                  if (code) navigate(`/unirse?code=${encodeURIComponent(code)}`, { replace: true });
                  else navigate('/descargar', { replace: true });
                }}
              >
                Reintentar vinculación
              </button>
            ) : null}
            <button className="btn secondary" onClick={() => navigate(-1)}>Volver</button>
          </div>
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

/** Redirige tokens OAuth que caen en / u otra ruta hacia /auth/callback. */
export function OAuthRedirectGuard(): null {
  const navigate = useNavigate();

  useEffect(() => {
    const { pathname, search, hash } = window.location;

    if (pathname === '/auth/callback' || pathname === '/auth/mobile-callback') return;

    if (hash.includes('access_token=') || hash.includes('error=') || hash.includes('error_description=')) {
      navigate(`/auth/callback${search}${hash}`, { replace: true });
      return;
    }

    const authCode = new URLSearchParams(search).get('code');
    if (authCode && authCode.length > 24 && pathname !== '/unirse') {
      navigate(`/auth/callback${search}`, { replace: true });
    }
  }, [navigate]);

  return null;
}
