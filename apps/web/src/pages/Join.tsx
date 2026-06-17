import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  clearPendingInviteCode,
  fetchInvitePreview,
  linkClientByInviteCode,
  normalizeInviteCode,
  readPendingInviteCode,
  savePendingInviteCode,
  type InvitePreview,
} from '@/lib/inviteClient';

const APK_URL = import.meta.env.VITE_ANDROID_APK_URL as string | undefined;
const TESTFLIGHT_URL = import.meta.env.VITE_IOS_TESTFLIGHT_URL as string | undefined;

export function JoinPage(): React.JSX.Element {
  const [params] = useSearchParams();
  const code = normalizeInviteCode(params.get('code') ?? readPendingInviteCode());
  const joined = params.get('joined') === '1';
  const viaGoogle = params.get('via') === 'google';

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [success, setSuccess] = useState(joined);
  const [emailPendingConfirm, setEmailPendingConfirm] = useState(false);

  useEffect(() => {
    if (code) savePendingInviteCode(code);
  }, [code]);

  useEffect(() => {
    if (!code) {
      setPreviewLoading(false);
      return;
    }
    void (async () => {
      const data = await fetchInvitePreview(code);
      setPreview(data);
      setPreviewLoading(false);
      if (!data) setError('El link de invitación no es válido o expiró.');
    })();
  }, [code]);

  useEffect(() => {
    if (!joined || !code) return;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await linkClientByInviteCode(code);
        clearPendingInviteCode();
        setSuccess(true);
      }
    })();
  }, [joined, code]);

  // Si ya tiene sesión (ej. Google) pero no quedó vinculado, reintentar al abrir el link
  useEffect(() => {
    if (!code || joined || success) return;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('trainer_id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile?.trainer_id) return;
      const link = await linkClientByInviteCode(code);
      if (link.ok) {
        clearPendingInviteCode();
        setSuccess(true);
      }
    })();
  }, [code, joined, success]);

  const onGoogle = async () => {
    if (!code) {
      setError('Falta el código de invitación en el link.');
      return;
    }
    setError(null);
    setOauthLoading(true);
    savePendingInviteCode(code);

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    setOauthLoading(false);
    if (oauthError) setError('No pudimos abrir Google. Intentá de nuevo.');
  };

  const onEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      setError('Falta el código de invitación en el link.');
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Ingresá tu nombre completo.');
      return;
    }
    if (!email.includes('@')) {
      setError('Ingresá un email válido.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setError(null);
    setSubmitting(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), trainer_code: code },
      },
    });

    if (signUpError) {
      setSubmitting(false);
      setError(signUpError.message.includes('already registered')
        ? 'Ese email ya está registrado. Iniciá sesión en la app.'
        : 'No pudimos crear tu cuenta. Intentá de nuevo.');
      return;
    }

    if (data.session) {
      const link = await linkClientByInviteCode(code);
      clearPendingInviteCode();
      setSubmitting(false);
      if (!link.ok) {
        setError(link.message);
        return;
      }
      setSuccess(true);
      return;
    }

    setSubmitting(false);
    setSuccess(true);
    setEmailPendingConfirm(true);
    setError(null);
  };

  if (previewLoading) {
    return (
      <div className="center-screen">
        <p className="muted">Cargando invitación…</p>
      </div>
    );
  }

  if (!code || !preview) {
    return (
      <div className="center-screen">
        <div className="login-box card join-card">
          <h1 className="page-title">Link inválido</h1>
          <p className="muted" style={{ marginBottom: 20 }}>
            Pedile a tu entrenador que te reenvíe el link de invitación.
          </p>
          <Link to="/descargar" className="btn secondary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Ir a descargar la app
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="center-screen">
        <div className="login-box card join-card">
          <div className="join-success-icon">✓</div>
          <h1 className="page-title" style={{ textAlign: 'center' }}>¡Listo!</h1>
          <p className="page-sub" style={{ textAlign: 'center', marginBottom: 24 }}>
            Ya estás vinculado a <strong>{preview.trainer_name ?? preview.app_name}</strong>.
            {emailPendingConfirm
              ? ' Revisá tu email y confirmá la cuenta antes de entrar a la app.'
              : ' Descargá la app e iniciá sesión con la misma cuenta.'}
          </p>

          <div className="join-download-actions">
            {APK_URL ? (
              <a className="btn" href={APK_URL} download style={{ textDecoration: 'none', textAlign: 'center' }}>
                Descargar Android
              </a>
            ) : null}
            {TESTFLIGHT_URL ? (
              <a className="btn secondary" href={TESTFLIGHT_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Instalar iPhone (TestFlight)
              </a>
            ) : null}
          </div>

          <ol className="join-steps">
            {emailPendingConfirm ? (
              <>
                <li>Revisá tu bandeja de entrada y confirmá el email.</li>
                <li>Instalá la app en tu teléfono.</li>
                <li>Iniciá sesión con el <strong>mismo email y contraseña</strong> que creaste.</li>
              </>
            ) : viaGoogle ? (
              <>
                <li>Instalá la app en tu teléfono.</li>
                <li>Abrila y tocá <strong>Iniciar sesión</strong>.</li>
                <li>Usá el botón <strong>Google</strong> con la misma cuenta (no email/contraseña).</li>
                <li>Completá el deslinde y el formulario de consulta al entrar.</li>
              </>
            ) : (
              <>
                <li>Instalá la app en tu teléfono.</li>
                <li>Abrila y tocá <strong>Iniciar sesión</strong>.</li>
                <li>Usá el mismo email y contraseña que creaste.</li>
                <li>Completá el deslinde y el formulario de consulta al entrar.</li>
              </>
            )}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="center-screen">
      <div className="login-box card join-card">
        {preview.logo_url ? (
          <img src={preview.logo_url} alt="" className="join-logo" />
        ) : null}

        <h1 className="page-title" style={{ textAlign: 'center' }}>
          Unite a {preview.app_name}
        </h1>
        <p className="page-sub" style={{ textAlign: 'center', marginBottom: 24 }}>
          {preview.trainer_name
            ? `${preview.trainer_name} te invitó. Creá tu cuenta en un minuto.`
            : 'Creá tu cuenta para empezar tu plan.'}
        </p>

        {error ? <div className="toast error">{error}</div> : null}

        <button
          type="button"
          className="btn join-google-btn"
          disabled={oauthLoading || submitting}
          onClick={() => void onGoogle()}
        >
          <GoogleIcon />
          {oauthLoading ? 'Abriendo Google…' : 'Continuar con Google'}
        </button>

        <div className="join-divider">
          <span>o con email</span>
        </div>

        <form onSubmit={(e) => void onEmailSignUp(e)}>
          <div className="field">
            <label>Nombre completo</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
          </div>
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
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={submitting || oauthLoading} style={{ width: '100%' }}>
            {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="join-foot muted">
          Al registrarte aceptás vincular tu cuenta con este entrenador.
          Código: <strong>{code}</strong>
        </p>
      </div>

      <style>{`
        .join-card { max-width: 420px; width: 100%; }
        .join-logo { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; margin: 0 auto 16px; display: block; }
        .join-google-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          background: #fff; color: #1f2937; border: 1px solid var(--border);
        }
        .join-google-btn:hover { background: #f9fafb; }
        .join-divider {
          display: flex; align-items: center; gap: 12px; margin: 20px 0;
          color: var(--text-tertiary); font-size: 12px;
        }
        .join-divider::before, .join-divider::after {
          content: ''; flex: 1; height: 1px; background: var(--border);
        }
        .join-foot { font-size: 12px; text-align: center; margin-top: 20px; line-height: 1.5; }
        .join-success-icon {
          width: 52px; height: 52px; border-radius: 50%; background: #dcfce7; color: #16a34a;
          display: flex; align-items: center; justify-content: center; font-size: 26px;
          font-weight: 700; margin: 0 auto 16px;
        }
        .join-download-actions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
        .join-steps { margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-secondary); line-height: 1.7; }
      `}</style>
    </div>
  );
}

function GoogleIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
