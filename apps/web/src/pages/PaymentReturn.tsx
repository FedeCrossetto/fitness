import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// Página intermedia a la que redirige MercadoPago tras el checkout de suscripción.
// MP (Preapproval) solo admite UNA back_url y no acepta deep links en ella, así
// que llega `?sub=<id>` y acá resolvemos el deep link real de la app
// (exp://… en Expo Go, reset-fitness://… en standalone) vía
// get_subscription_return_url, y ofrecemos un botón para volver.
//
// Clave: el botón dispara la navegación al deep link con un GESTO del usuario
// (tap). El intento automático (sin gesto) lo bloquea Safari en iOS — por eso
// el botón es el mecanismo principal, no el fallback. El estado real del pago
// (aprobado/pending/rechazado) lo resuelve la app al volver (mp-sync), no esta
// página: por eso el copy es neutro ("pago recibido / volvé a la app").
export function PaymentReturnPage(): React.JSX.Element {
  const { result } = useParams<{ result: string }>();
  const isError = result === 'error';
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

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
    if (deepLink) window.location.href = deepLink;
  }, [deepLink]);

  return (
    <div style={styles.wrap}>
      <div style={styles.emoji}>{isError ? '😕' : '✅'}</div>
      <h1 style={styles.title}>{isError ? 'No se completó el pago' : '¡Pago recibido!'}</h1>

      <p style={styles.sub}>
        {isError
          ? 'Cerrá esta ventana y volvé a la app para intentarlo de nuevo.'
          : 'Volvé a la app para continuar. Ahí vas a ver la confirmación y el siguiente paso.'}
      </p>

      {deepLink ? (
        <button style={styles.btn} onClick={goToApp}>
          Volver a la app
        </button>
      ) : resolving ? (
        <p style={styles.hint}>Cargando…</p>
      ) : (
        <p style={styles.hint}>
          Cerrá esta ventana y volvé a la app manualmente — se va a actualizar sola.
        </p>
      )}

      <p style={styles.hint}>
        Si el botón no abre la app, cerrá esta ventana y abrila vos: se actualiza sola.
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
    padding: '16px 36px',
    fontSize: 17,
    fontWeight: 700,
    color: '#0f0f0f',
    background: '#C1ED00',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
  },
  hint: { fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 300, lineHeight: 1.5 },
};
