import type { Language } from '@reset-fitness/shared';

/** Contenido localizado de un ejercicio. El catálogo guarda ambos idiomas en
 * metadata.i18n = { es: {instructions, muscle}, en: {instructions, muscle} }.
 * Devuelve el set del idioma del usuario con fallback al otro / a los campos
 * top-level. Espejo del helper del panel web. */
export interface LocalizedExercise {
  name: string | null;
  instructions: string[];
  muscle: string | null;
}

type I18nEntry = { name?: string; instructions?: string[]; muscle?: string };

export function localizedExercise(
  exercise: { name?: string | null; metadata?: unknown; instructions?: string[] | null; target_muscles?: string[] | null; body_part?: string | null },
  locale: Language,
): LocalizedExercise {
  const i18n = (exercise.metadata as { i18n?: Record<string, I18nEntry> } | null)?.i18n;
  const other: Language = locale === 'es' ? 'en' : 'es';
  const pick = i18n?.[locale] ?? i18n?.[other];
  return {
    name: pick?.name || exercise.name || null,
    instructions: pick?.instructions?.length ? pick.instructions : (exercise.instructions ?? []),
    muscle: pick?.muscle || exercise.target_muscles?.[0] || exercise.body_part || null,
  };
}
