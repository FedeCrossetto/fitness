import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { GoalType } from '../types/database';
import { fetchTodaySteps } from '../services/steps';
import { useProgressStore } from '../stores/progressStore';

/** Re-sincroniza pasos al volver de Ajustes / Salud u otra app. */
export function useStepsAutoSync(
  userId: string | undefined,
  syncAutoGoal: (userId: string, goalType: GoalType, currentValue: number) => Promise<boolean>
): void {
  useEffect(() => {
    if (!userId) return;

    const sync = () => {
      if (!useProgressStore.getState().healthConnected) return;
      void (async () => {
        const todaySteps = await fetchTodaySteps(true);
        if (todaySteps !== null) {
          useProgressStore.getState().setSteps(todaySteps);
          await syncAutoGoal(userId, 'steps', todaySteps);
        }
      })();
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    return () => sub.remove();
  }, [userId, syncAutoGoal]);
}
