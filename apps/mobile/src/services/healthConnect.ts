import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

export type HealthConnectConnectResult =
  | { ok: true; steps: number }
  | { ok: false; reason: 'module_missing' | 'unavailable' | 'denied' | 'needs_update' };

type HealthConnectModule = typeof import('react-native-health-connect');

const STEP_READ = { accessType: 'read' as const, recordType: 'Steps' as const };

function getModule(): HealthConnectModule | null {
  if (Platform.OS !== 'android') return null;
  if (Constants.appOwnership === 'expo') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect') as HealthConnectModule;
  } catch {
    return null;
  }
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function hasStepsReadPermission(
  granted: Array<{ accessType?: string; recordType?: string }>
): boolean {
  return granted.some(
    (p) => p.accessType === 'read' && p.recordType === 'Steps'
  );
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  try {
    const status = await hc.getSdkStatus();
    return status === hc.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function needsHealthConnectUpdate(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  try {
    const status = await hc.getSdkStatus();
    return status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED;
  } catch {
    return false;
  }
}

async function ensureInitialized(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  if (!(await isHealthConnectAvailable())) return false;
  try {
    return await hc.initialize();
  } catch {
    return false;
  }
}

/** Pide permiso de lectura de pasos en Health Connect. */
export async function initHealthConnectForSteps(): Promise<boolean> {
  const hc = getModule();
  if (!hc || !(await ensureInitialized())) return false;
  try {
    const granted = await hc.requestPermission([STEP_READ]);
    if (hasStepsReadPermission(granted)) return true;
    const existing = await hc.getGrantedPermissions();
    return hasStepsReadPermission(existing);
  } catch {
    return false;
  }
}

async function readTodayStepsFromModule(): Promise<number | null> {
  const hc = getModule();
  if (!hc || !(await ensureInitialized())) return null;

  let total = 0;
  let pageToken: string | undefined;

  try {
    do {
      const result = await hc.readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfTodayIso(),
          endTime: new Date().toISOString(),
        },
        pageToken,
      });
      for (const record of result.records) {
        total += record.count ?? 0;
      }
      pageToken = result.pageToken;
    } while (pageToken);
    return total;
  } catch {
    return null;
  }
}

export async function readTodayStepsFromHealthConnect(): Promise<number | null> {
  const ok = await initHealthConnectForSteps();
  if (!ok) return null;
  return readTodayStepsFromModule();
}

/** Conecta Health Connect y lee pasos agregados de hoy (Garmin, Google Fit, sensor, etc.). */
export async function connectHealthConnect(): Promise<HealthConnectConnectResult> {
  const hc = getModule();
  if (!hc) return { ok: false, reason: 'module_missing' };

  if (await needsHealthConnectUpdate()) {
    return { ok: false, reason: 'needs_update' };
  }

  if (!(await isHealthConnectAvailable())) {
    return { ok: false, reason: 'unavailable' };
  }

  if (!(await initHealthConnectForSteps())) {
    return { ok: false, reason: 'denied' };
  }

  const steps = await readTodayStepsFromModule();
  return { ok: true, steps: steps ?? 0 };
}

export function openHealthConnectSettingsScreen(): void {
  const hc = getModule();
  if (hc?.openHealthConnectSettings) {
    hc.openHealthConnectSettings();
    return;
  }
  void Linking.openSettings();
}

export async function openHealthConnectInstall(): Promise<void> {
  const playStore =
    'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
  const can = await Linking.canOpenURL(playStore).catch(() => false);
  if (can) {
    await Linking.openURL(playStore).catch(() => undefined);
    return;
  }
  openHealthConnectSettingsScreen();
}
