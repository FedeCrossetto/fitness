import type { ExerciseRow } from '@reset-fitness/shared/types/database';
import type { Language } from '@reset-fitness/shared';

/** Contenido localizado de un ejercicio. El catálogo guarda ambos idiomas en
 * metadata.i18n = { es: {instructions, muscle}, en: {instructions, muscle} }.
 * Devolvemos el set del idioma pedido con fallback al otro / a los campos
 * top-level, para que ejercicios viejos sin i18n sigan funcionando. */
export interface LocalizedExercise {
  instructions: string[];
  muscle: string;
}

export function localizedExercise(exercise: ExerciseRow, locale: Language): LocalizedExercise {
  const i18n = (exercise.metadata as { i18n?: Record<string, { instructions?: string[]; muscle?: string }> } | null)?.i18n;
  const other: Language = locale === 'es' ? 'en' : 'es';
  const pick = i18n?.[locale] ?? i18n?.[other];
  return {
    instructions: pick?.instructions?.length ? pick.instructions : (exercise.instructions ?? []),
    muscle: pick?.muscle || exercise.target_muscles?.[0] || exercise.body_part || '—',
  };
}
