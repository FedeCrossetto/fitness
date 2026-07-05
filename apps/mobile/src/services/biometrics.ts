import AsyncStorage from '@react-native-async-storage/async-storage';

// Lazy import — el módulo nativo solo existe en dev builds que incluyan expo-local-authentication.
// Si no está disponible (Expo Go o build sin rebuild), se degrada silenciosamente.
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- carga condicional, no puede ser un import estático
  LocalAuthentication = require('expo-local-authentication') as typeof import('expo-local-authentication');
} catch {
  LocalAuthentication = null;
}

/** Preferencia y decisión son POR USUARIO: si cierra sesión, el bloqueo
 * biométrico de ese usuario queda sin efecto (no hay sesión que desbloquear) y
 * si otro usuario inicia sesión en el mismo dispositivo, no hereda ni afecta
 * la configuración ajena. */
const prefKey = (userId: string): string => `reset-fitness:biometric-lock:${userId}`;
const decidedKey = (userId: string): string => `reset-fitness:biometric-setup-decided:${userId}`;

export async function isHardwareSupported(): Promise<boolean> {
  if (!LocalAuthentication) return false;
  try {
    const [hasHW, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHW && enrolled;
  } catch {
    return false;
  }
}

export async function getPreference(userId: string): Promise<boolean> {
  const pref = await AsyncStorage.getItem(prefKey(userId));
  return pref === 'true';
}

export async function setPreference(userId: string, value: boolean): Promise<void> {
  await AsyncStorage.setItem(prefKey(userId), String(value));
}

/** Si el usuario ya pasó por la pantalla de configuración (activó o eligió
 * "Quizás más tarde") — para no volver a ofrecérsela en cada activación. */
export async function hasDecidedSetup(userId: string): Promise<boolean> {
  const decided = await AsyncStorage.getItem(decidedKey(userId));
  return decided === 'true';
}

export async function markSetupDecided(userId: string): Promise<void> {
  await AsyncStorage.setItem(decidedKey(userId), 'true');
}

export async function authenticate(): Promise<boolean> {
  if (!LocalAuthentication) return true; // sin módulo nativo, no bloqueamos
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Verificá tu identidad para continuar',
    fallbackLabel: 'Usar código',
    cancelLabel: 'Cancelar',
  });
  return result.success;
}
