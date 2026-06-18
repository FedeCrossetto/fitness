import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export const PUSH_MESSAGES_PREF_KEY = 'habito:push-messages-enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function listenToMessageTaps(onMessage: () => void): () => void {
  const isMessage = (resp: Notifications.NotificationResponse | null): boolean =>
    resp?.notification.request.content.data?.type === 'message';

  void Notifications.getLastNotificationResponseAsync().then((resp) => {
    if (isMessage(resp)) onMessage();
  });

  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    if (isMessage(resp)) onMessage();
  });
  return () => sub.remove();
}

export async function isPushMessagesEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PUSH_MESSAGES_PREF_KEY);
  return value !== 'false';
}

export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

async function requestNotificationPermissions(): Promise<Notifications.PermissionStatus> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return existing;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return status;
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Mensajes',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FFFFFF',
    sound: 'default',
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Recordatorios',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#FFFFFF',
  });
}

export type EnablePushResult = 'enabled' | 'denied' | 'simulator' | 'missing_apns' | 'error';

function isMissingApnsEntitlement(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('aps-environment');
}

/** Pide permisos, obtiene el Expo push token y lo registra en la DB. */
export async function registerPushToken(userId: string): Promise<EnablePushResult> {
  if (!Device.isDevice) return 'simulator';

  await ensureAndroidChannels();

  const status = await requestNotificationPermissions();
  if (status !== 'granted') {
    console.warn('[push] Permiso de notificaciones no concedido:', status);
    return status === 'denied' ? 'denied' : 'error';
  }

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] Falta EAS projectId en app.json');
    return 'error';
  }

  let expoToken: string;
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    expoToken = token.data;
  } catch (err) {
    console.warn('[push] No se pudo obtener Expo push token:', err);
    if (isMissingApnsEntitlement(err)) return 'missing_apns';
    return 'error';
  }

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_token: expoToken,
      platform: Platform.OS,
      device_id: Device.modelId ?? Device.modelName ?? null,
      is_active: true,
    },
    { onConflict: 'user_id,expo_token' },
  );

  if (error) {
    console.warn('[push] Error guardando token:', error.message);
    return 'error';
  }

  console.log('[push] Token registrado:', expoToken.slice(0, 24), '…');
  return 'enabled';
}

export async function deactivatePushTokens(userId: string): Promise<void> {
  await supabase.from('push_tokens').update({ is_active: false }).eq('user_id', userId);
}

/** Registra push si el usuario lo tiene habilitado en ajustes de la app. */
export async function syncPushRegistration(userId: string): Promise<void> {
  if (!(await isPushMessagesEnabled())) return;
  await registerPushToken(userId);
}

export async function enablePushMessages(userId: string): Promise<EnablePushResult> {
  await AsyncStorage.setItem(PUSH_MESSAGES_PREF_KEY, 'true');
  return registerPushToken(userId);
}

export async function disablePushMessages(userId: string): Promise<void> {
  await AsyncStorage.setItem(PUSH_MESSAGES_PREF_KEY, 'false');
  await deactivatePushTokens(userId);
}

export function openNotificationSettings(): void {
  void Linking.openSettings();
}

export async function scheduleDailyReminder(
  identifier: string,
  title: string,
  body: string,
  hour: number,
  minute: number,
): Promise<void> {
  await ensureAndroidChannels();
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === 'android' ? 'reminders' : undefined,
    },
  });
}

export async function cancelReminder(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
}
