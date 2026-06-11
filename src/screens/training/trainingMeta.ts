import type { Ionicons } from '@expo/vector-icons';
import type { WorkoutType } from '../../types/database';

/** Metadata visual por tipo de día/entrenamiento (ícono outline + label es-AR). */
export const DAY_TYPE_META: Record<WorkoutType, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  fuerza: { label: 'Fuerza', icon: 'barbell-outline' },
  cardio: { label: 'Cardio', icon: 'pulse-outline' },
  descanso: { label: 'Descanso', icon: 'moon-outline' },
  movilidad: { label: 'Movilidad', icon: 'body-outline' },
  tecnica: { label: 'Técnica', icon: 'school-outline' },
};
