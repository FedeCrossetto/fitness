import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

type Callback = () => void;

const subscribers = new Set<Callback>();
let registered = false;
let last: AppStateStatus = AppState.currentState;

function ensureListener(): void {
  if (registered) return;
  registered = true;
  AppState.addEventListener('change', (next) => {
    if (last.match(/inactive|background/) && next === 'active') {
      subscribers.forEach((cb) => cb());
    }
    last = next;
  });
}

/**
 * Llama callback cada vez que la app vuelve al frente.
 * Un solo listener de AppState para toda la app — no N listeners en paralelo.
 */
export function useAppActive(callback: Callback): void {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    ensureListener();
    const cb: Callback = () => ref.current();
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
  }, []);
}
