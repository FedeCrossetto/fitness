import { useTrainingStore } from './trainingStore';
import { useProgressStore } from './progressStore';
import { useInboxStore } from './inboxStore';
import { useNutritionStore } from './nutritionStore';

/**
 * Limpia todos los stores de datos de usuario.
 * Llamar al cerrar sesión antes de limpiar authStore.
 */
export function resetAllStores(): void {
  useTrainingStore.getState().reset();
  useProgressStore.getState().reset();
  useInboxStore.getState().reset();
  // nutritionStore no tiene reset propio; limpiamos directamente.
  useNutritionStore.setState({ meals: [], loading: false, error: null });
}
