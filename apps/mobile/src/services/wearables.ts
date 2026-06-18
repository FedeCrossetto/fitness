import { Alert, Linking, Platform } from 'react-native';
import { openAppleHealthSettings } from './health';
import { openHealthConnectInstall, openHealthConnectSettingsScreen } from './healthConnect';

type GarminGuideCopy = {
  garmin_title: string;
  garmin_guide_ios: string;
  garmin_guide_android: string;
  garmin_open_garmin: string;
  garmin_open_health: string;
  ok: string;
};

export async function openGarminConnect(): Promise<void> {
  const urls = ['garminconnect://', 'https://connect.garmin.com/'];
  for (const url of urls) {
    const can = await Linking.canOpenURL(url).catch(() => false);
    if (can) {
      await Linking.openURL(url).catch(() => undefined);
      return;
    }
  }
}

export function openPlatformHealthSettings(): void {
  if (Platform.OS === 'ios') {
    void openAppleHealthSettings();
    return;
  }
  openHealthConnectSettingsScreen();
}

/** Guía para que Garmin / reloj alimente Habito vía Salud o Health Connect. */
export function showGarminSetupGuide(t: GarminGuideCopy): void {
  const isIos = Platform.OS === 'ios';
  Alert.alert(
    t.garmin_title,
    isIos ? t.garmin_guide_ios : t.garmin_guide_android,
    [
      { text: t.garmin_open_garmin, onPress: () => void openGarminConnect() },
      {
        text: t.garmin_open_health,
        onPress: () => {
          if (isIos) void openAppleHealthSettings();
          else openHealthConnectSettingsScreen();
        },
      },
      { text: t.ok, style: 'cancel' },
    ]
  );
}

export async function showHealthConnectInstallPrompt(
  title: string,
  message: string,
  installLabel: string,
  cancelLabel: string
): Promise<void> {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: installLabel, onPress: () => void openHealthConnectInstall() },
  ]);
}
