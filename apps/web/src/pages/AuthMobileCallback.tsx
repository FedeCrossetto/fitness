import { useEffect, useState } from 'react';

const APP_SCHEME = 'reset-fitness';
const APP_CALLBACK_PATH = 'auth/callback';

/**
 * Puente OAuth mobile: Supabase redirige acá (HTTPS allowlisted) y esta página
 * reenvía el code/tokens al deep link de la app nativa.
 */
export function AuthMobileCallbackPage(): React.JSX.Element {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const { search, hash } = window.location;
    const deepLink = `${APP_SCHEME}://${APP_CALLBACK_PATH}${search}${hash}`;

    window.location.replace(deepLink);

    const timer = window.setTimeout(() => setFailed(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  if (failed) {
    return (
      <div className="center-screen">
        <div className="login-box card" style={{ textAlign: 'center', maxWidth: 360 }}>
          <h1 className="page-title" style={{ fontSize: 20 }}>Volvé a la app</h1>
          <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
            Si no se abrió Reset Fit automáticamente, cerrá esta pestaña y volvé a intentar desde la app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="center-screen">
      <p className="muted">Abriendo Reset Fit…</p>
    </div>
  );
}
