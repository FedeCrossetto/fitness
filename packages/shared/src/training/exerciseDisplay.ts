/** Nombres de ícono Ionicons usados como fallback cuando no hay GIF. */
export type ExerciseFallbackIcon =
  | 'barbell-outline'
  | 'body-outline'
  | 'fitness-outline'
  | 'walk-outline'
  | 'heart-outline'
  | 'accessibility-outline';

/**
 * Política de imágenes de ejercicios para la app consumer (App Store).
 *
 * Catálogos tipo ExerciseDB suelen traer ilustraciones con licencia restrictiva.
 * Por defecto NO mostramos URLs externas en mobile; solo assets propios o Storage del trainer.
 */
export function canShowExerciseImage(
  imageUrl: string | null | undefined,
  externalSource: string | null | undefined,
): boolean {
  if (!imageUrl?.trim()) return false;
  if (imageUrl.includes('/storage/v1/object/')) return true;
  if (externalSource?.trim()) return false;
  if (imageUrl.startsWith('asset:') || imageUrl.startsWith('/')) return true;
  return false;
}

/** Ícono por zona muscular cuando no hay imagen disponible. */
export function resolveExerciseFallbackIcon(
  bodyPart: string | null | undefined,
  targetMuscle?: string | null,
): ExerciseFallbackIcon {
  const haystack = `${bodyPart ?? ''} ${targetMuscle ?? ''}`.toLowerCase();

  if (/pecho|chest|pectoral|push|empuje/.test(haystack)) return 'body-outline';
  if (/espalda|back|dorsal|tirón|tiron|pull|remo/.test(haystack)) return 'accessibility-outline';
  if (/pierna|leg|cuádricep|cuadricep|glúteo|gluteo|isquio|gemelo|calf|squat|sentadilla|zancada/.test(haystack)) {
    return 'walk-outline';
  }
  if (/hombro|shoulder|deltoid|deltoide|militar/.test(haystack)) return 'body-outline';
  if (/core|abdominal|abs|plancha|oblicuo|lumb/.test(haystack)) return 'fitness-outline';
  if (/cardio|correr|run|trote|salt/.test(haystack)) return 'heart-outline';
  if (/brazo|arm|bícep|bicep|trícep|tricep|curl/.test(haystack)) return 'barbell-outline';

  return 'barbell-outline';
}
