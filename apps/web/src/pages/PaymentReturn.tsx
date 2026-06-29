import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';

// Página intermedia a la que redirige MercadoPago tras el pago.
// MP no acepta deep links en back_urls, por lo que esta página HTTPS recibe el
// resultado y le muestra al usuario cómo volver a la app.
// La app detecta el retorno via useAppActive + polling → no necesita deep link.
export function PaymentReturnPage(): React.JSX.Element {
  const { result } = useParams<{ result: string }>();
  const isError = result === 'error';
  const returnParam = new URLSearchParams(window.location.search).get('return');
  const deepLink = returnParam ?? `reset-fitness://pago/${result ?? 'exito'}`;
  const [tried, setTried] = useState(false);

  const goToApp = useCallback(() => {
    setTried(true);
    window.location.href = deepLink;
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
      <button style={styles.btn} onClick={goToApp}>
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
