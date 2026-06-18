// Componentes de UI compartidos para estados de carga, error y vacío.

export function Skeleton({ width, height = 16, radius = 6, style }: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <span
      className="skeleton"
      style={{ width: width ?? '100%', height, borderRadius: radius, ...style }}
      aria-hidden
    />
  );
}

/** Filas de carga genéricas para listas/tablas. */
export function LoadingRows({ rows = 4 }: { rows?: number }): React.JSX.Element {
  return (
    <div className="loading-rows" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="loading-row">
          <Skeleton width={40} height={40} radius={10} />
          <div className="loading-row-lines">
            <Skeleton width="40%" height={13} />
            <Skeleton width="65%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Estado de error con botón de reintento. */
export function ErrorState({ message, onRetry }: {
  message?: string | null;
  onRetry?: () => void;
}): React.JSX.Element {
  return (
    <div className="error-state card">
      <div className="error-state-ico" aria-hidden>!</div>
      <div className="t">No pudimos cargar esto</div>
      <p className="muted" style={{ marginBottom: onRetry ? 16 : 0 }}>
        {message ?? 'Ocurrió un problema. Intentá de nuevo.'}
      </p>
      {onRetry ? (
        <button className="btn secondary" onClick={onRetry}>Reintentar</button>
      ) : null}
    </div>
  );
}
