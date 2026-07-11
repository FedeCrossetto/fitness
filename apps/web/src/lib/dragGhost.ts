/** Crea un "fantasma" flotante que sigue al cursor mientras se arrastra una
 * card — clona el DOM de la card y lo posiciona con `position: fixed`, igual
 * que el drag & drop de app.hevycoach.com. La card original queda como hueco
 * (placeholder) vía la clase `.dragging`. */
export interface DragGhost {
  move: (ev: { clientX: number; clientY: number }) => void;
  destroy: () => void;
}

export function createDragGhost(card: HTMLElement, e: { clientX: number; clientY: number }): DragGhost {
  const rect = card.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  const ghost = card.cloneNode(true) as HTMLElement;
  ghost.classList.add('drag-ghost');
  ghost.classList.remove('dragging');
  Object.assign(ghost.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: '9999',
    transition: 'none',
    transform: `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px) rotate(1.5deg)`,
  });
  document.body.appendChild(ghost);

  return {
    move(ev) {
      ghost.style.transform = `translate(${ev.clientX - offsetX}px, ${ev.clientY - offsetY}px) rotate(1.5deg)`;
    },
    destroy() {
      ghost.remove();
    },
  };
}
