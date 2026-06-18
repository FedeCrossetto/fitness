import { Alert, Platform } from 'react-native';
import { connectAppleHealth, openAppleHealthSettings } from './health';
import {
  connectHealthConnect,
  needsHealthConnectUpdate,
  openHealthConnectInstall,
  openHealthConnectSettingsScreen,
} from './healthConnect';
import { getTodayStepsFromSensor } from './pedometer';

export type PlatformHealthConnectResult =
  | { ok: true; steps: number }
  | {
      ok: false;
      reason:
        | 'module_missing'
        | 'unavailable'
        | 'denied'
        | 'needs_update'
        | 'sensor_denied';
    };

type HealthErrorCopy = {
  no_access: string;
  health_no_perm_ios: string;
  health_no_perm_and: string;
  health_needs_hc_update: string;
  health_open: string;
  health_open_hc: string;
  cancel: string;
  install_hc: string;
};

export async function connectPlatformHealth(): Promise<PlatformHealthConnectResult> {
  if (Platform.OS === 'ios') {
    const result = await connectAppleHealth();
    if (result.ok) return result;

    const sensor = await getTodayStepsFromSensor();
    if (sensor !== null) return { ok: true, steps: sensor };

    if (result.reason === 'denied' || result.reason === 'unavailable') {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'module_missing' };
  }

  if (await needsHealthConnectUpdate()) {
    return { ok: false, reason: 'needs_update' };
  }

  const hc = await connectHealthConnect();
  if (hc.ok) return hc;

  const sensor = await getTodayStepsFromSensor();
  if (sensor !== null) return { ok: true, steps: sensor };

  return { ok: false, reason: hc.reason === 'denied' ? 'denied' : hc.reason };
}

export async function showPlatformHealthError(
  result: PlatformHealthConnectResult,
  t: HealthErrorCopy
): Promise<void> {
  if (result.ok) return;

  if (result.reason === 'needs_update') {
    Alert.alert(t.no_access, t.health_needs_hc_update, [
      { text: t.cancel, style: 'cancel' },
      { text: t.install_hc, onPress: () => void openHealthConnectInstall() },
    ]);
    return;
  }

  Alert.alert(
    t.no_access,
    Platform.OS === 'ios' ? t.health_no_perm_ios : t.health_no_perm_and,
    [
      { text: t.cancel, style: 'cancel' },
      {
        text: Platform.OS === 'ios' ? t.health_open : t.health_open_hc,
        onPress: () => {
          if (Platform.OS === 'ios') void openAppleHealthSettings();
          else openHealthConnectSettingsScreen();
        },
      },
    ]
  );
}
