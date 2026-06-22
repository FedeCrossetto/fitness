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
  if (externalSource?.trim()) return false;
  if (imageUrl.includes('/storage/v1/object/')) return true;
  if (imageUrl.startsWith('asset:') || imageUrl.startsWith('/')) return true;
  return false;
}
