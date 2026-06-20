/**
 * Tipos de la base de datos: fuente única en `@reset-fitness/shared`.
 *
 * Este archivo solo re-exporta los tipos del paquete compartido para que el
 * resto de la app mobile pueda seguir importando desde `../types/database`
 * sin cambiar cada import. NO definir tipos acá: editá
 * `packages/shared/src/types/database.ts` (o regeneralo con la Supabase CLI).
 */
export * from '@reset-fitness/shared/types/database';
