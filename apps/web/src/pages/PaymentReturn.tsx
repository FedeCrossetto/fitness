import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// Página intermedia a la que redirige MercadoPago tras el pago.
// MP no acepta deep links en back_urls, por lo que esta página HTTPS recibe el
// resultado y redirige al deep link de la app.
//
// Pago único (Preferencias): el deep link viaja directo en `?return=`.
// Suscripción recurrente (Preapproval): MP rechaza un back_url con un esquema
// custom codificado en el query, así que viaja `?sub=<subscription id>` y acá
// se resuelve el deep link real (el `exp://…` del entorno) vía
// get_subscription_return_url.
//
// Si el deep link no se puede resolver, NO forzamos un redirect inválido (eso
// tiraba "Safari cannot open the page"): la app igual detecta el pago sola
// cuando el usuario vuelve al frente (useCheckout → useAppActive → polling).
export function PaymentReturnPage(): React.JSX.Element {
  const { result } = useParams<{ result: string }>();
  const isError = result === 'error';
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnParam = params.get('return');
    const subId = params.get('sub');

    if (returnParam) {
      setDeepLink(returnParam);
      setResolving(false);
      return;
    }
    if (subId) {
      void (async () => {
        try {
          const { data } = await supabase.rpc('get_subscription_return_url', { p_id: subId });
          setDeepLink((data as string | null) ?? null);
        } finally {
          setResolving(false);
        }
      })();
      return;
    }
    setResolving(false);
  }, []);

  const goToApp = useCallback(() => {
    if (!deepLink) return;
    setTried(true);
    window.location.href = deepLink;
  }, [deepLink]);

  // Intento automático apenas se resuelve el deep link (mejor esfuerzo para
  // volver "directo"). El botón queda como fallback si el browser lo bloquea.
  useEffect(() => {
    if (deepLink) goToApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  return (
    <div style={styles.wrap}>
      <div style={styles.emoji}>{isError ? '😕' : '✅'}</div>
      <h1 style={styles.title}>{isError ? 'No se completó el pago' : '¡Pago confirmado!'}</h1>

      {isError ? (
        <p style={styles.sub}>Cerrá esta ventana y volvé a intentarlo desde la app.</p>
      ) : (
        <p style={styles.sub}>
          Volvé a la app para continuar. Tu suscripción se activa automáticamente.
        </p>
      )}

      {deepLink ? (
        <button style={styles.btn} onClick={goToApp}>
          Volver a la app
        </button>
      ) : resolving ? (
        <p style={styles.hint}>Cargando…</p>
      ) : null}

      <p style={styles.hint}>
        {tried
          ? 'Si no se abrió sola, cerrá esta ventana y volvé a la app manualmente — se va a actualizar sola.'
          : 'También podés cerrar esta ventana y volver a la app: se actualiza sola.'}
      </p>
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
    padding: '14px 32px',
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    background: '#22c55e',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
  },
  hint: { fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 300, lineHeight: 1.5 },
};
