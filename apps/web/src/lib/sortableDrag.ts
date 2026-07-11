import { createDragGhost } from '@/lib/dragGhost';

/** Drag de lista ordenable con reordenamiento visual EN VIVO: mientras se
 * arrastra una card por encima de otra, la lista se reordena al instante
 * (la card destino se corre al lugar que dejó la arrastrada) y el cambio se
 * persiste recién al soltar. Una card fantasma sigue al cursor y la original
 * queda como hueco (clase `.dragging`).
 *
 * El componente mantiene el array ordenado en estado y expone:
 *  - `move(from, to)`: reordena SOLO el estado local (sin persistir).
 *  - `commit()`: persiste el orden final.
 */
export function startSortableDrag(params: {
  event: React.MouseEvent;
  index: number;
  /** Selector de la card arrastrable, ej. '.rex-card'. */
  cardSelector: string;
  /** Nombre camelCase del data-attribute con el índice, ej. 'exIndex' (data-ex-index). */
  dataAttr: string;
  /** Reordena el estado local en vivo (from → to). */
  move: (from: number, to: number) => void;
  /** Persiste el orden final. Se llama solo si hubo cambios. */
  commit: () => void;
  /** Refleja qué índice se está arrastrando (para la clase `.dragging`). */
  setDragIndex: (i: number | null) => void;
  /** Selector de controles que NO deben iniciar el drag. */
  ignoreSelector?: string;
}): void {
  const { event, index, cardSelector, dataAttr, move, commit, setDragIndex } = params;
  if (event.button !== 0) return;
  const ignore = params.ignoreSelector ?? 'input, textarea, button, select, a, .client-row-menu';
  if ((event.target as HTMLElement).closest(ignore)) return;
  const card = (event.target as HTMLElement).closest<HTMLElement>(cardSelector);
  if (!card) return;

  const startX = event.clientX;
  const startY = event.clientY;
  const fromIndex = index;
  let currentIndex = index;
  let moved = false;
  let ghost: ReturnType<typeof createDragGhost> | null = null;

  const onMove = (ev: MouseEvent) => {
    if (!moved) {
      if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
      moved = true;
      setDragIndex(currentIndex);
      document.body.classList.add('is-dragging-card');
      ghost = createDragGhost(card, { clientX: startX, clientY: startY });
    }
    ghost?.move(ev);
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
    const row = el?.closest<HTMLElement>(`[data-${camelToKebab(dataAttr)}]`);
    if (!row) return;
    const overIndex = Number(row.dataset[dataAttr]);
    if (Number.isNaN(overIndex) || overIndex === currentIndex) return;
    move(currentIndex, overIndex); // reordena el estado en vivo
    currentIndex = overIndex;
    setDragIndex(currentIndex);
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (!moved) return;
    ghost?.destroy();
    document.body.classList.remove('is-dragging-card');
    setDragIndex(null);
    if (currentIndex !== fromIndex) commit();
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
