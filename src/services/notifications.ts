import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Pide permisos, obtiene el Expo push token y lo registra en la DB. */
export async function registerPushToken(userId: string): Promise<boolean> {
  if (!Device.isDevice) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#BEFC50',
    });
  }

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_token: token.data,
      platform: Platform.OS,
      device_id: Device.modelId ?? Device.modelName ?? null,
      is_active: true,
    },
    { onConflict: 'user_id,expo_token' }
  );
  return !error;
}

/** Programa un recordatorio local diario (agua / entreno / comidas). */
export async function scheduleDailyReminder(
  identifier: string,
  title: string,
  body: string,
  hour: number,
  minute: number
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelReminder(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
}
