// Componentes de UI compartidos para estados de carga, error y vacío.

import { useEffect } from 'react';

/** Visor de imagen a pantalla completa (lightbox). Cierra con click en el fondo o Escape. */
export function Lightbox({ src, caption, onClose }: {
  src: string | null;
  caption?: string;
  onClose: () => void;
}): React.JSX.Element | null {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  if (!src) return null;
  return (
    <div className="lightbox-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <button className="lightbox-close" onClick={onClose} aria-label="Cerrar">✕</button>
      <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={caption ?? ''} className="lightbox-img" />
        {caption ? <figcaption className="lightbox-caption">{caption}</figcaption> : null}
      </figure>
    </div>
  );
}

/** Spinner monocromático. */
export function Spinner({ size = 22 }: { size?: number }): React.JSX.Element {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden />;
}

/** Loader a pantalla completa (auth, transiciones). */
export function FullScreenLoader(): React.JSX.Element {
  return (
    <div className="center-screen" role="status" aria-live="polite" aria-busy="true">
      <Spinner size={26} />
    </div>
  );
}

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
