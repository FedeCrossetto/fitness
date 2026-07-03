import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const FALLBACK_SCHEME_PREFIX = 'reset-fitness://pago/';

// Página intermedia a la que redirige MercadoPago tras el pago.
// MP no acepta deep links en back_urls, por lo que esta página HTTPS recibe el
// resultado y redirige al esquema de la app.
//
// Pago único (Preferencias): el deep link viaja directo en `?return=`.
// Suscripción recurrente (Preapproval): MP rechaza un back_url con un
// esquema custom codificado en el query, así que viaja `?sub=<subscription
// id>` y acá se resuelve el deep link real vía get_subscription_return_url
// (necesario en Expo Go, donde solo el esquema exp://… es resoluble — el
// esquema fijo de la app no está registrado ahí).
export function PaymentReturnPage(): React.JSX.Element {
  const { result } = useParams<{ result: string }>();
  const isError = result === 'error';
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnParam = params.get('return');
    const subId = params.get('sub');
    if (returnParam) {
      setDeepLink(returnParam);
      return;
    }
    if (subId) {
      void (async () => {
        const { data } = await supabase.rpc('get_subscription_return_url', { p_id: subId });
        setDeepLink((data as string | null) ?? `${FALLBACK_SCHEME_PREFIX}${result ?? 'exito'}`);
      })();
      return;
    }
    setDeepLink(`${FALLBACK_SCHEME_PREFIX}${result ?? 'exito'}`);
  }, [result]);

  const goToApp = useCallback(() => {
    if (!deepLink) return;
    setTried(true);
    window.location.href = deepLink;
  }, [deepLink]);

  // Intento automático apenas se resuelve el deep link — algunos browsers
  // bloquean el redirect a un esquema custom sin gesto del usuario, así que
  // el botón queda como fallback.
  useEffect(() => {
    if (deepLink) goToApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  return (
    <div style={styles.wrap}>
      <div style={styles.emoji}>{isError ? '😕' : '✅'}</div>
      <h1 style={styles.title}>{isError ? 'No se completó el pago' : '¡Pago confirmado!'}</h1>
      <p style={styles.sub}>
        {isError
          ? 'Podés cerrar esta ventana y volver a intentarlo desde la app.'
          : 'Cerrá esta ventana o tocá el botón para volver a la app.'}
      </p>
      <button style={styles.btn} onClick={goToApp} disabled={!deepLink}>
        Volver a la app
      </button>
      {tried && (
        <p style={styles.hint}>
          Si no se abrió la app, cerrá esta ventana manualmente.
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f0f',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    gap: 14,
    padding: 24,
    textAlign: 'center',
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { fontSize: 15, color: '#9ca3af', margin: 0, maxWidth: 320, lineHeight: 1.5 },
  btn: {
    marginTop: 10,
    padding: '12px 28px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: '#22c55e',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
  },
  hint: { fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 280, lineHeight: 1.5 },
};
