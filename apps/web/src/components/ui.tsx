// Componentes de UI compartidos para estados de carga, error y vacío.

import { useEffect, useRef, useState } from 'react';
import { useTrainerBranding } from '@/hooks/useTrainerBranding';

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

/** Loader a pantalla completa (auth, transiciones). El logo que se rellena es
 * el que el entrenador cargó en su branding; si no cargó ninguno, cae al logo
 * de la plataforma (definido en .logo-loader de styles.css). */
export function FullScreenLoader(): React.JSX.Element {
  const { logoUrl } = useTrainerBranding();
  const mask = logoUrl ? `url("${logoUrl}") center / contain no-repeat` : undefined;
  return (
    <div className="center-screen" role="status" aria-live="polite" aria-busy="true">
      <div
        className="logo-loader"
        aria-label="Cargando"
        style={mask ? { WebkitMask: mask, mask } : undefined}
      >
        <span className="logo-loader-fill" />
      </div>
    </div>
  );
}

/** Diálogo de confirmación (reemplaza window.confirm). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop confirm-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal confirm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h2 id="confirm-dialog-title" className="confirm-modal-title">{title}</h2>
        <p className="confirm-modal-msg">{message}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`btn${danger ? ' danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
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

/** Estado vacío consistente: ícono + título + subtítulo + acción opcional. */
export function EmptyState({ icon, title, sub, action }: {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  action?: { label: string; onClick: () => void };
}): React.JSX.Element {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-ico" aria-hidden>{icon}</div> : null}
      <div className="t">{title}</div>
      {sub ? <p className="empty-sub">{sub}</p> : null}
      {action ? (
        <button className="btn" style={{ marginTop: 16 }} onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Cuenta animada de 0 → value al montar (efecto count-up de dashboards pro).
 * Respeta prefers-reduced-motion. Devuelve el número actual a renderizar.
 */
export function useCountUp(value: number, durationMs = 900): number {
  const [n, setN] = useState(0);
  const ref = useRef(value);
  ref.current = value;
  useEffect(() => {
    if (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number): void => {
      const p = Math.min(1, (t - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setN(from + (ref.current - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setN(ref.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return n;
}
