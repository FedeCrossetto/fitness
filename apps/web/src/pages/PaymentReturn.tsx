import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

// Página intermedia a la que redirige MercadoPago tras el pago.
// Como MP no acepta deep links (reset-fitness://) en back_urls, usamos esta
// página https:// que inmediatamente reenvía a la app mobile vía deep link.
// El cliente NO tiene acceso al panel web, así que esta pantalla es neutral
// y nunca lo manda a rutas del entrenador.
export function PaymentReturnPage(): React.JSX.Element {
  const { result } = useParams<{ result: string }>();
  const isError = result === 'error';
  const deepLink = `reset-fitness://pago/${result ?? 'exito'}`;
  const [showManual, setShowManual] = useState(false);

  const goToApp = useCallback(() => {
    window.location.href = deepLink;
  }, [deepLink]);

  useEffect(() => {
    // Intento inmediato de volver a la app.
    goToApp();
    // Si en 1.5s seguimos acá (el deep link no abrió la app), mostramos el botón.
    const t = setTimeout(() => setShowManual(true), 1500);
    return () => clearTimeout(t);
  }, [goToApp]);

  return (
    <div style={styles.wrap}>
      <div style={styles.emoji}>{isError ? '😕' : '✅'}</div>
      <h1 style={styles.title}>{isError ? 'No se completó el pago' : '¡Pago confirmado!'}</h1>
      <p style={styles.sub}>
        {isError
          ? 'Podés volver a la app e intentarlo de nuevo.'
          : 'Estamos volviendo a la app…'}
      </p>
      {showManual && (
        <button style={styles.btn} onClick={goToApp}>
          Volver a la app
        </button>
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
};
