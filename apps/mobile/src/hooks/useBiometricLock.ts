import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppActive } from './useAppActive';
import { useAuthStore } from '../stores/authStore';
import { useBiometricStore } from '../stores/biometricStore';

export interface BiometricLockState {
  enabled: boolean;
  supported: boolean;
  locked: boolean;
  toggle: () => Promise<void>;
  authenticate: () => Promise<boolean>;
}

/** Wrapper del store compartido de biometría — mantiene la misma firma que
 * antes para no tocar los call sites (App.tsx, ProfileScreen). La lógica de
 * bloqueo/preferencia vive en `biometricStore` (ver ahí el porqué). */
export function useBiometricLock(): BiometricLockState {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const supported = useBiometricStore((s) => s.supported);
  const enabled = useBiometricStore((s) => s.enabled);
  const locked = useBiometricStore((s) => s.locked);
  const toggle = useBiometricStore((s) => s.toggle);
  const authenticate = useBiometricStore((s) => s.authenticate);

  useEffect(() => {
    void useBiometricStore.getState().loadForUser(userId);
  }, [userId]);

  // Registra cuándo la app va a background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: string) => {
      if (state === 'background' || state === 'inactive') {
        useBiometricStore.getState().markBackground();
      }
    });
    return () => sub.remove();
  }, []);

  // Al volver al foreground, bloquea si hay sesión activa, está habilitado y
  // pasó el tiempo de gracia. Lee el store en el momento (no un closure viejo)
  // para reflejar un `enabled` recién activado desde otra pantalla.
  useAppActive(() => {
    const hasSession = !!useAuthStore.getState().session;
    useBiometricStore.getState().checkForegroundLock(hasSession);
  });

  return { enabled, supported, locked, toggle, authenticate };
}
