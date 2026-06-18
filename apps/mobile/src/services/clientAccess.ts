import type { ProfileRow } from '../types/database';

export const INVITE_REQUIRED_MESSAGE =
  'Ingresá el código de invitación que te compartió tu entrenador.';

export const INVITE_LINK_FAILED_MESSAGE =
  'Ese código no es válido. Verificá con tu entrenador e intentá de nuevo.';

export function isStaffProfile(profile: ProfileRow | null | undefined): boolean {
  return profile?.role === 'trainer' || profile?.role === 'admin';
}

/** Alumno vinculado a un entrenador, o cuenta staff. */
export function canAccessApp(profile: ProfileRow | null | undefined): boolean {
  if (!profile) return false;
  if (isStaffProfile(profile)) return true;
  return profile.role === 'client' && !!profile.trainer_id;
}

/** Sesión activa pero falta vincular entrenador (cliente sin trainer_id). */
export function needsTrainerLink(profile: ProfileRow | null | undefined): boolean {
  if (!profile) return false;
  if (isStaffProfile(profile)) return false;
  return profile.role === 'client' && !profile.trainer_id;
}

/**
 * Cliente vinculado pero todavía no activado por el entrenador (estado 'pending').
 * Mientras esté pendiente, la app queda bloqueada (no puede usar funciones).
 */
export function isPendingActivation(profile: ProfileRow | null | undefined): boolean {
  if (!profile) return false;
  if (isStaffProfile(profile)) return false;
  return profile.role === 'client' && !!profile.trainer_id && profile.client_status === 'pending';
}
