import { Linking, NativeModules, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

/**
 * Integración con Apple HealthKit (react-native-health).
 * Solo disponible en iPhone físico con iOS real. El simulador tiene el framework
 * compilado pero HealthKit no funciona en él — la llamada devuelve error o cuelga.
 * Toda llamada degrada a null si el módulo no está disponible o es simulador.
 */

export interface HealthSnapshot {
  weightKg: number | null;
  steps: number | null;
  heartRate: number | null;
  sleepHours: number | null;
}

export type HealthConnectResult =
  | { ok: true; steps: number }
  | { ok: false; reason: 'module_missing' | 'unavailable' | 'denied' | 'no_steps' };

interface HealthValue {
  value: number;
  startDate: string;
  endDate: string;
}

type HealthCallback<T> = (error: string | null, results: T) => void;

interface AppleHealthKitModule {
  Constants: { Permissions: Record<string, string> };
  isAvailable: (callback: (error: string | null, available: boolean) => void) => void;
  initHealthKit: (permissions: unknown, callback: (error: string | null) => void) => void;
  getLatestWeight: (options: { unit: string }, callback: HealthCallback<HealthValue>) => void;
  getStepCount: (
    options: { date?: string; includeManuallyAdded?: boolean },
    callback: HealthCallback<HealthValue>
  ) => void;
  getDailyStepCountSamples: (
    options: { startDate: string; endDate: string },
    callback: HealthCallback<HealthValue[]>
  ) => void;
  getHeartRateSamples: (
    options: { startDate: string; endDate: string; limit: number },
    callback: HealthCallback<HealthValue[]>
  ) => void;
  getSleepSamples: (
    options: { startDate: string; endDate: string },
    callback: HealthCallback<HealthValue[]>
  ) => void;
}

/** true cuando la app corre en Expo Go (no en un build nativo) */
export const isExpoGo = Constants.appOwnership === 'expo';

function getModule(): AppleHealthKitModule | null {
  if (Platform.OS !== 'ios') return null;
  if (!Device.isDevice) return null;
  if (isExpoGo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-health') as { default?: AppleHealthKitModule } & AppleHealthKitModule;
    const resolved = mod.default ?? mod;
    if (!resolved || typeof resolved.initHealthKit !== 'function') {
      const native = NativeModules.AppleHealthKit as AppleHealthKitModule | undefined;
      if (native && typeof native.initHealthKit === 'function') {
        return Object.assign(native, { Constants: resolved?.Constants ?? native.Constants });
      }
      return null;
    }
    return resolved;
  } catch {
    const native = NativeModules.AppleHealthKit as AppleHealthKitModule | undefined;
    return native && typeof native.initHealthKit === 'function' ? native : null;
  }
}

/** Fecha local con offset explícito — el parser nativo a veces falla con sufijo Z. */
function toHealthKitDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const tz = `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000${tz}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function isHealthKitAvailable(): Promise<boolean> {
  const health = getModule();
  if (!health?.isAvailable) return false;
  return new Promise((resolve) => {
    health.isAvailable((_error, available) => resolve(!!available));
  });
}

async function initHealthKitWithPermissions(read: string[], write: string[] = []): Promise<boolean> {
  const health = getModule();
  if (!health) return false;
  if (!(await isHealthKitAvailable())) return false;

  const permissions = {
    permissions: {
      read: read.filter(Boolean),
      write: write.filter(Boolean),
    },
  };

  return new Promise((resolve) => {
    health.initHealthKit(permissions, (error) => resolve(!error));
  });
}

/** Pide permiso de lectura de pasos (mínimo necesario para sincronizar). */
export async function initHealthKitForSteps(): Promise<boolean> {
  const health = getModule();
  if (!health) return false;
  const stepCount = health.Constants.Permissions.StepCount;
  return initHealthKitWithPermissions([stepCount].filter(Boolean));
}

/** Pide permisos amplios para el panel de progreso. */
export async function initHealthKit(): Promise<boolean> {
  const health = getModule();
  if (!health) return false;
  const p = health.Constants.Permissions;
  return initHealthKitWithPermissions(
    [p.StepCount, p.Weight, p.HeartRate, p.SleepAnalysis].filter(Boolean),
    [p.Weight].filter(Boolean)
  );
}

async function readTodayStepsFromModule(): Promise<number | null> {
  const health = getModule();
  if (!health) return null;

  const readCount = (): Promise<number | null> =>
    new Promise((resolve) => {
      // Sin `date`: el nativo usa hoy en calendario local (más fiable que ISO UTC).
      health.getStepCount({ includeManuallyAdded: true }, (error, result) => {
        if (error || result == null || typeof result.value !== 'number') {
          resolve(null);
          return;
        }
        resolve(Math.round(result.value));
      });
    });

  const direct = await readCount();
  if (direct !== null) return direct;

  const start = startOfToday();
  const now = new Date();
  return new Promise((resolve) => {
    health.getDailyStepCountSamples(
      { startDate: toHealthKitDate(start), endDate: toHealthKitDate(now) },
      (error, samples) => {
        if (error || !samples?.length) {
          resolve(null);
          return;
        }
        const total = samples.reduce((acc, s) => acc + (s.value ?? 0), 0);
        resolve(Math.round(total));
      }
    );
  });
}

export async function readTodaySteps(): Promise<number | null> {
  const ok = await initHealthKitForSteps();
  if (!ok) return null;
  return readTodayStepsFromModule();
}

export async function readHealthSnapshot(): Promise<HealthSnapshot | null> {
  const ok = await initHealthKit();
  if (!ok) return null;

  const health = getModule();
  if (!health) return null;

  const startOfDay = startOfToday();
  const now = new Date();

  const weight = await new Promise<number | null>((resolve) => {
    health.getLatestWeight({ unit: 'gram' }, (error, result) =>
      resolve(error || !result ? null : result.value / 1000)
    );
  });

  const steps = await readTodayStepsFromModule();

  const heartRate = await new Promise<number | null>((resolve) => {
    health.getHeartRateSamples(
      { startDate: toHealthKitDate(startOfDay), endDate: toHealthKitDate(now), limit: 1 },
      (error, results) => resolve(error || !results?.length ? null : results[0]!.value)
    );
  });

  const sleepHours = await new Promise<number | null>((resolve) => {
    const sleepStart = new Date(now);
    sleepStart.setDate(sleepStart.getDate() - 1);
    health.getSleepSamples(
      { startDate: toHealthKitDate(sleepStart), endDate: toHealthKitDate(now) },
      (error, results) => {
        if (error || !results?.length) return resolve(null);
        const totalMs = results.reduce(
          (acc, s) => acc + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()),
          0
        );
        resolve(Math.round((totalMs / 3600000) * 10) / 10);
      }
    );
  });

  return { weightKg: weight, steps, heartRate, sleepHours };
}

export async function getTodayStepsFromHealth(): Promise<number | null> {
  return readTodaySteps();
}

/** Conecta Apple Salud, pide permisos de pasos y lee el total de hoy. */
export async function connectAppleHealth(): Promise<HealthConnectResult> {
  if (!getModule()) return { ok: false, reason: 'module_missing' };
  if (!(await isHealthKitAvailable())) return { ok: false, reason: 'unavailable' };
  if (!(await initHealthKitForSteps())) return { ok: false, reason: 'denied' };

  const steps = await readTodayStepsFromModule();
  // Permiso concedido: conectamos aunque hoy sea 0 o la lectura tarde un instante.
  return { ok: true, steps: steps ?? 0 };
}

export async function openAppleHealthSettings(): Promise<void> {
  const urls = ['x-apple-health://', 'App-Prefs:HEALTH'];
  for (const url of urls) {
    const can = await Linking.canOpenURL(url).catch(() => false);
    if (can) {
      await Linking.openURL(url).catch(() => undefined);
      return;
    }
  }
  await Linking.openSettings();
}
