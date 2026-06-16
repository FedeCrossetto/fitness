import { requireOptionalNativeModule } from 'expo';

import type { StartLiveActivityParams, UpdateLiveActivityParams } from './ActivityController.types';

type NativeActivityController = {
  areLiveActivitiesEnabled: boolean;
  isActivityRunning: () => boolean;
  startLiveActivity: (rawData: string) => Promise<string>;
  updateLiveActivity: (rawData: string) => Promise<void>;
  stopLiveActivity: () => Promise<void>;
};

// `requireOptionalNativeModule` devuelve null cuando el módulo no existe
// (Android / web / Expo Go), así que todo queda como no-op sin romper el import.
const native = requireOptionalNativeModule<NativeActivityController>('ActivityController');

export const areLiveActivitiesEnabled = (): boolean => native?.areLiveActivitiesEnabled ?? false;

export const isActivityRunning = (): boolean => native?.isActivityRunning() ?? false;

export async function startLiveActivity(params: StartLiveActivityParams): Promise<string | null> {
  if (!native) return null;
  return native.startLiveActivity(JSON.stringify(params));
}

export async function updateLiveActivity(params: UpdateLiveActivityParams): Promise<void> {
  if (!native) return;
  await native.updateLiveActivity(JSON.stringify(params));
}

export async function stopLiveActivity(): Promise<void> {
  if (!native) return;
  await native.stopLiveActivity();
}
