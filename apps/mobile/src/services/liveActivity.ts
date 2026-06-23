import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  startLiveActivity,
  updateLiveActivity,
  stopLiveActivity,
} from '../../modules/activity-controller';

/**
 * Presencia del entrenamiento en curso fuera de la app (pantalla bloqueada /
 * segundo plano).
 *
 * - iOS: Live Activity real (ActivityKit + widget SwiftUI) → tarjeta de lock
 *   screen e isla dinámica con timer. Implementada en el módulo nativo
 *   `modules/activity-controller`. Solo corre en dev build / release, NO en Expo Go.
 * - Android: notificación *ongoing* (sticky) que queda fija mientras dura la
 *   sesión y se actualiza con el progreso.
 */

import {
  liveCompletedCount,
  liveTotalSets,
  resolveLiveActivityFocus,
  type ActiveSession,
} from '../lib/trainingSession';

export interface LiveWorkoutState {
  workoutTitle: string;
  /** epoch ms de inicio */
  startedAt: number;
  completed: number;
  total: number;
  exerciseName: string;
  currentSet: number;
  exerciseSetCount: number;
  weightKg: number | null;
  reps: number | null;
}

export function buildLiveWorkoutState(session: ActiveSession): LiveWorkoutState {
  const focus = resolveLiveActivityFocus(session);
  return {
    workoutTitle: session.workoutTitle,
    startedAt: session.startedAt,
    completed: liveCompletedCount(session),
    total: liveTotalSets(session),
    ...focus,
  };
}

const WORKOUT_NOTIFICATION_ID = 'reset-fitness:live-workout';
const WORKOUT_CHANNEL_ID = 'workout';
const BRAND_COLOR = '#BEFC50';

let channelReady = false;
let active = false;

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(WORKOUT_CHANNEL_ID, {
    name: 'Entrenamiento en curso',
    importance: Notifications.AndroidImportance.LOW,
    lightColor: BRAND_COLOR,
    showBadge: false,
    enableVibrate: false,
    sound: null,
  });
  channelReady = true;
}

function describe(state: LiveWorkoutState): string {
  const minutes = Math.max(0, Math.floor((Date.now() - state.startedAt) / 60000));
  const time = minutes >= 1 ? `${minutes} min` : 'Recién empezó';
  const setLine = state.weightKg != null && state.reps != null
    ? `${state.weightKg} kg x ${state.reps}`
    : state.exerciseName;
  return `${time} · ${setLine}`;
}

async function present(state: LiveWorkoutState): Promise<void> {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: WORKOUT_NOTIFICATION_ID,
    content: {
      title: state.workoutTitle || 'Entrenamiento en curso',
      body: describe(state),
      sticky: true,
      autoDismiss: false,
      color: BRAND_COLOR,
      sound: false,
    },
    trigger: { channelId: WORKOUT_CHANNEL_ID },
  });
}

export async function startLiveWorkout(state: LiveWorkoutState): Promise<void> {
  active = true;
  try {
    if (Platform.OS === 'ios') {
      await startLiveActivity({
        workoutTitle: state.workoutTitle || 'Entrenamiento',
        startedAt: Math.floor(state.startedAt / 1000),
        completed: state.completed,
        total: state.total,
        exerciseName: state.exerciseName,
        currentSet: state.currentSet,
        exerciseSetCount: state.exerciseSetCount,
        weightKg: state.weightKg,
        reps: state.reps,
      });
    } else if (Platform.OS === 'android') {
      await present(state);
    }
  } catch {
    active = false;
  }
}

export async function updateLiveWorkout(state: LiveWorkoutState): Promise<void> {
  if (!active) return;
  try {
    if (Platform.OS === 'ios') {
      await updateLiveActivity({
        completed: state.completed,
        total: state.total,
        exerciseName: state.exerciseName,
        currentSet: state.currentSet,
        exerciseSetCount: state.exerciseSetCount,
        weightKg: state.weightKg,
        reps: state.reps,
      });
    } else if (Platform.OS === 'android') {
      await present(state);
    }
  } catch {
    // mantener la sesión aunque falle el refresco de la presencia externa
  }
}

export async function endLiveWorkout(): Promise<void> {
  active = false;
  if (Platform.OS === 'ios') {
    await stopLiveActivity().catch(() => undefined);
    return;
  }
  if (Platform.OS === 'android') {
    await Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => undefined);
  }
}
