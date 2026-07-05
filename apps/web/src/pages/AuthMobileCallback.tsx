import { useEffect, useState } from 'react';

const APP_SCHEME      = 'reset-fitness';
const APP_CALLBACK_PATH = 'auth/callback';

/**
 * Puente OAuth/recovery mobile: Supabase redirige acá (HTTPS allowlisted) y esta página
 * reenvía el code/tokens al deep link de la app nativa o Expo Go.
 *
 * En Expo Go el deep link de vuelta es `exp://<ip-lan>:<puerto>/--/...` — dinámico,
 * cambia en cada sesión de Metro, así que esta página no puede adivinarlo con un
 * scheme fijo (`exp+reset-fitness://` NO es un scheme real de Expo Go). Cuando el
 * flujo se inició desde la app (ver getPasswordResetRedirectUri), el link trae un
 * `?deep_link=` con la URL real de esa sesión — la usamos tal cual en vez de adivinar.
 */
export function AuthMobileCallbackPage(): React.JSX.Element {
  const [failed, setFailed] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const knownExpoLink = params.get('deep_link');

  useEffect(() => {
    const { search, hash } = window.location;
    const suffix   = `${search}${hash}`;
    const deepLink = knownExpoLink ? `${knownExpoLink}${suffix}` : `${APP_SCHEME}://${APP_CALLBACK_PATH}${suffix}`;

    window.location.replace(deepLink);

    // Si no abre después de 2.5s, mostramos opciones fallback (incluyendo Expo Go)
    const timer = window.setTimeout(() => setFailed(true), 2500);
    return () => window.clearTimeout(timer);
  }, [knownExpoLink]);

  if (failed) {
    const { search, hash } = window.location;
    const suffix       = `${search}${hash}`;
    const deepLink     = `${APP_SCHEME}://${APP_CALLBACK_PATH}${suffix}`;
    const expoGoLink   = knownExpoLink ? `${knownExpoLink}${suffix}` : null;

    return (
      <div className="center-screen">
        <div className="login-box card" style={{ textAlign: 'center', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="page-title" style={{ fontSize: 20 }}>Volvé a la app</h1>
          <p className="muted" style={{ lineHeight: 1.5 }}>
            Seleccioná cómo abriste la app:
          </p>

          {/* Opción 1: Expo Go (desarrollo) — solo si sabemos el deep link real de
              esta sesión de Metro (viene en ?deep_link=). Sin eso no hay un scheme
              fijo que funcione en Expo Go, así que no mostramos un botón roto. */}
          {expoGoLink ? (
            <a
              href={expoGoLink}
              style={{
                display: 'block',
                padding: '12px 20px',
                background: '#C1ED00',
                color: '#07090A',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 1,
                textDecoration: 'none',
              }}
            >
              ABRIR EN EXPO GO
            </a>
          ) : null}

          {/* Opción 2: App nativa instalada */}
          <a
            href={deepLink}
            style={{
              display: 'block',
              padding: '12px 20px',
              background: '#1a1d1f',
              color: '#ffffff',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: 1,
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            ABRIR EN APP INSTALADA
          </a>

          <p className="muted" style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>
            ¿Seguís con problemas? Cerrá esta pestaña, abrí la app y pedí un nuevo link.
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
