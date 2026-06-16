import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

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
  const code = (params.get('code') ?? '').trim().toUpperCase();
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
        <div className="dl-brand">CustomFit</div>
        <h1 className="dl-title">Descargá la app</h1>
        <p className="dl-sub">Instalá la app en tu teléfono y registrate con tu código para empezar.</p>

        {code ? (
          <div className="dl-code">
            <span className="dl-code-label">Tu código de invitación</span>
            <div className="dl-code-row">
              <span className="dl-code-value">{code}</span>
              <button type="button" className="btn secondary sm" onClick={() => void copyCode()}>
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
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
          <li>Descargá e instalá la app en tu teléfono.</li>
          <li>Abrila y tocá “Crear cuenta”.</li>
          <li>
            {code ? (
              <>Ingresá el código <strong>{code}</strong> para vincularte a tu entrenador.</>
            ) : (
              <>Ingresá el código que te pasó tu entrenador.</>
            )}
          </li>
        </ol>
      </div>
    </div>
  );
}
