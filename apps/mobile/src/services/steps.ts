import { Platform } from 'react-native';
import { getTodayStepsFromHealth } from './health';
import { readTodayStepsFromHealthConnect } from './healthConnect';
import { connectPlatformHealth, type PlatformHealthConnectResult } from './healthPlatform';
import { getTodayStepsFromSensor } from './pedometer';

export type StepsConnectResult = PlatformHealthConnectResult;

/**
 * Lee los pasos del día según plataforma y conexión:
 * - iOS → Apple Salud (+ respaldo sensor)
 * - Android → Health Connect (+ respaldo sensor)
 */
export async function fetchTodaySteps(healthConnected: boolean): Promise<number | null> {
  if (!healthConnected) return null;

  if (Platform.OS === 'ios') {
    const fromHealth = await getTodayStepsFromHealth();
    if (fromHealth !== null) return fromHealth;
    return getTodayStepsFromSensor();
  }

  const fromHc = await readTodayStepsFromHealthConnect();
  if (fromHc !== null) return fromHc;
  return getTodayStepsFromSensor();
}

/** Conecta la fuente de salud de la plataforma (Salud en iOS, Health Connect en Android). */
export async function connectTodaySteps(): Promise<StepsConnectResult> {
  return connectPlatformHealth();
}

export { getTodayStepsFromSensor } from './pedometer';
