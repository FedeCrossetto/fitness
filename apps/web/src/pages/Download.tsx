import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { normalizeInviteCode, DEFAULT_APP_NAME } from '@reset-fitness/shared';

type Platform = 'ios' | 'android' | 'other';

const APK_URL = import.meta.env.VITE_ANDROID_APK_URL as string | undefined;
const TESTFLIGHT_URL = import.meta.env.VITE_IOS_TESTFLIGHT_URL as string | undefined;

function detectPlatform(): Platform {
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

export function DownloadPage(): React.JSX.Element {
  const [params] = useSearchParams();
  const code = normalizeInviteCode(params.get('code') ?? '');
  const platform = useMemo(detectPlatform, []);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="dl-screen">
      <div className="dl-card">
        <div className="dl-brand">{DEFAULT_APP_NAME}</div>
        <h1 className="dl-title">Descargá la app</h1>
        <p className="dl-sub">
          {code
            ? 'Registrate primero con el link de tu entrenador y después instalá la app.'
            : 'Instalá la app en tu teléfono para empezar.'}
        </p>

        {code ? (
          <>
            <Link
              to={`/unirse?code=${encodeURIComponent(code)}`}
              className="btn dl-store primary"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 12 }}
            >
              Crear cuenta con Google o email
            </Link>
            <div className="dl-code">
              <span className="dl-code-label">Código de invitación</span>
              <div className="dl-code-row">
                <span className="dl-code-value">{code}</span>
                <button type="button" className="btn secondary sm" onClick={() => void copyCode()}>
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div className="dl-actions">
          {APK_URL ? (
            <a className="dl-store primary" href={APK_URL} download>
              Descargar para Android (.apk)
            </a>
          ) : (
            <span className="dl-store primary disabled">Descarga para Android · Próximamente</span>
          )}

          {platform === 'android' || platform === 'other' ? (
            <p className="dl-note">
              Al instalar, Android puede pedirte permitir “Instalar apps de orígenes desconocidos”.
              Aceptá para continuar.
            </p>
          ) : null}

          {platform === 'ios' ? (
            TESTFLIGHT_URL ? (
              <a className="dl-store" href={TESTFLIGHT_URL} target="_blank" rel="noreferrer">
                Instalar en iPhone (TestFlight)
              </a>
            ) : (
              <p className="dl-note">
                En iPhone la app se instala por TestFlight. Pedile el enlace a tu entrenador.
              </p>
            )
          ) : null}
        </div>

        <ol className="dl-steps">
          {code ? (
            <>
              <li>Tocá <strong>Crear cuenta</strong> arriba y registrate con Google o email.</li>
              <li>Descargá e instalá la app en tu teléfono.</li>
              <li>Iniciá sesión con la misma cuenta que creaste.</li>
            </>
          ) : (
            <>
              <li>Descargá e instalá la app en tu teléfono.</li>
              <li>Abrila y tocá “Crear cuenta”.</li>
              <li>Ingresá el código que te pasó tu entrenador.</li>
            </>
          )}
        </ol>
      </div>
    </div>
  );
}
