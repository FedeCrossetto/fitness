import {
  INVITE_CODE_STORAGE_KEY,
  buildInviteLink,
  normalizeInviteCode,
  type InvitePreview,
} from '@habito/shared';
import { supabase } from '@/lib/supabase';

export { INVITE_CODE_STORAGE_KEY, buildInviteLink, normalizeInviteCode, type InvitePreview };

export function getJoinBaseUrl(): string {
  return (
    (import.meta.env.VITE_APP_DOWNLOAD_URL as string | undefined)?.replace(/\/$/, '') ??
    window.location.origin
  );
}

export function savePendingInviteCode(code: string): void {
  const clean = normalizeInviteCode(code);
  if (clean) sessionStorage.setItem(INVITE_CODE_STORAGE_KEY, clean);
}

export function readPendingInviteCode(): string | null {
  return sessionStorage.getItem(INVITE_CODE_STORAGE_KEY);
}

export function clearPendingInviteCode(): void {
  sessionStorage.removeItem(INVITE_CODE_STORAGE_KEY);
}

export async function fetchInvitePreview(code: string): Promise<InvitePreview | null> {
  const clean = normalizeInviteCode(code);
  if (!clean) return null;

  const { data, error } = await supabase.rpc('get_invite_preview', {
    p_invite_code: clean,
  });

  if (error || !data) return null;
  return data as unknown as InvitePreview;
}

export async function linkClientByInviteCode(code: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const clean = normalizeInviteCode(code);
  if (!clean) return { ok: false, message: 'Código de invitación inválido.' };

  const { error } = await supabase.rpc('link_client_by_invite_code', {
    p_invite_code: clean,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('invalid_invite_code')) return { ok: false, message: 'El código de invitación no existe.' };
    if (msg.includes('trainer_cannot_be_client')) return { ok: false, message: 'Esta cuenta es de entrenador. Usá otra cuenta para unirte como alumno.' };
    if (msg.includes('not_authenticated')) return { ok: false, message: 'Tenés que iniciar sesión primero.' };
    return { ok: false, message: 'No pudimos vincularte. Intentá de nuevo.' };
  }

  return { ok: true };
}
