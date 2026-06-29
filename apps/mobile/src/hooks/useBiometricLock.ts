import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppActive } from './useAppActive';
import { useAuthStore } from '../stores/authStore';

// Lazy import — el módulo nativo solo existe en dev builds que incluyan expo-local-authentication.
// Si no está disponible (Expo Go o build sin rebuild), se degrada silenciosamente.
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LocalAuthentication = require('expo-local-authentication') as typeof import('expo-local-authentication');
} catch {
  LocalAuthentication = null;
}

const PREF_KEY = 'reset-fitness:biometric-lock';
const GRACE_MS = 5 * 60_000; // 5 min en background antes de pedir auth de nuevo

export interface BiometricLockState {
  enabled: boolean;
  supported: boolean;
  locked: boolean;
  toggle: () => Promise<void>;
  authenticate: () => Promise<boolean>;
}

export function useBiometricLock(): BiometricLockState {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    if (!LocalAuthentication) return;
    const LA = LocalAuthentication;
    void (async () => {
      const hasHW = await LA.hasHardwareAsync();
      const enrolled = await LA.isEnrolledAsync();
      setSupported(hasHW && enrolled);
      const pref = await AsyncStorage.getItem(PREF_KEY);
      if (pref === 'true' && hasHW && enrolled) {
        setEnabled(true);
        // No bloqueamos al inicio: el lock solo se activa al volver del background
        // con sesión activa (ver useAppActive). Así no interfiere con login/marketing.
      }
    })();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!LocalAuthentication) return true; // sin módulo nativo, no bloqueamos
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verificá tu identidad para continuar',
      fallbackLabel: 'Usar código',
      cancelLabel: 'Cancelar',
    });
    if (result.success) setLocked(false);
    return result.success;
  }, []);

  const toggle = useCallback(async (): Promise<void> => {
    if (!supported) return;
    const next = !enabled;
    if (next) {
      const ok = await authenticate();
      if (!ok) return;
    }
    await AsyncStorage.setItem(PREF_KEY, String(next));
    setEnabled(next);
    setLocked(false);
  }, [enabled, supported, authenticate]);

  // Registra cuándo la app va a background
  useEffect(() => {
    const { AppState } = require('react-native') as typeof import('react-native');
    const sub = AppState.addEventListener('change', (state: string) => {
      if (state === 'background' || state === 'inactive') {
        backgroundAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  // Al volver al foreground, bloquea si hay sesión activa y pasó el tiempo de gracia
  useAppActive(() => {
    if (!enabled) return;
    const hasSession = !!useAuthStore.getState().session;
    if (!hasSession) return; // sin sesión no tiene sentido pedir biometría
    const since = backgroundAt.current;
    if (since !== null && Date.now() - since >= GRACE_MS) {
      setLocked(true);
    }
    backgroundAt.current = null;
  });

  return { enabled, supported, locked, toggle, authenticate };
}
