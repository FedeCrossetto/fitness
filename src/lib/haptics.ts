import * as Haptics from 'expo-haptics';

/** Feedback háptico centralizado para acciones clave. Nunca rompe si el dispositivo no lo soporta. */

export function hapticTap(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function hapticSelect(): void {
  Haptics.selectionAsync().catch(() => undefined);
}

export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticWarning(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

export function hapticError(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}
