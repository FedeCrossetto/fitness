import { Platform } from 'react-native';
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

interface HealthValue {
  value: number;
  startDate: string;
  endDate: string;
}

type HealthCallback<T> = (error: string | null, results: T) => void;

interface AppleHealthKitModule {
  Constants: { Permissions: Record<string, string> };
  initHealthKit: (permissions: unknown, callback: (error: string | null) => void) => void;
  getLatestWeight: (options: { unit: string }, callback: HealthCallback<HealthValue>) => void;
  getStepCount: (options: { date: string }, callback: HealthCallback<HealthValue>) => void;
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
  if (!Device.isDevice) return null; // simulador — HealthKit no disponible
  if (isExpoGo) return null;        // Expo Go — módulo nativo no compilado
  try {
    // require dinámico: el módulo nativo no existe en Expo Go ni en Android
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-health') as { default?: AppleHealthKitModule } & AppleHealthKitModule;
    const resolved = mod.default ?? mod;
    // En Expo Go el require no falla pero el módulo nativo viene sin métodos:
    // validamos la forma para degradar a null en vez de explotar al usarlo.
    if (!resolved || typeof resolved.initHealthKit !== 'function') return null;
    return resolved;
  } catch {
    return null;
  }
}

export async function initHealthKit(): Promise<boolean> {
  const health = getModule();
  if (!health) return false;

  const p = health.Constants.Permissions;
  const permissions = {
    permissions: {
      read: [p.Weight, p.StepCount, p.HeartRate, p.SleepAnalysis].filter(Boolean),
      write: [p.Weight].filter(Boolean),
    },
  };

  return new Promise((resolve) => {
    health.initHealthKit(permissions, (error) => resolve(!error));
  });
}

export async function readHealthSnapshot(): Promise<HealthSnapshot | null> {
  const health = getModule();
  if (!health) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();

  const weight = await new Promise<number | null>((resolve) => {
    health.getLatestWeight({ unit: 'gram' }, (error, result) =>
      resolve(error || !result ? null : result.value / 1000)
    );
  });

  const steps = await new Promise<number | null>((resolve) => {
    health.getStepCount({ date: now.toISOString() }, (error, result) =>
      resolve(error || !result ? null : result.value)
    );
  });

  const heartRate = await new Promise<number | null>((resolve) => {
    health.getHeartRateSamples(
      { startDate: startOfDay.toISOString(), endDate: now.toISOString(), limit: 1 },
      (error, results) => resolve(error || !results?.length ? null : results[0]!.value)
    );
  });

  const sleepHours = await new Promise<number | null>((resolve) => {
    const sleepStart = new Date(now);
    sleepStart.setDate(sleepStart.getDate() - 1);
    health.getSleepSamples(
      { startDate: sleepStart.toISOString(), endDate: now.toISOString() },
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
