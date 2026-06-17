import AsyncStorage from '@react-native-async-storage/async-storage';
import { INVITE_CODE_STORAGE_KEY, normalizeInviteCode } from '@habito/shared';
import { supabase } from '../lib/supabase';
import { INVITE_LINK_FAILED_MESSAGE } from './clientAccess';

export async function savePendingInviteCode(code: string): Promise<void> {
  const clean = normalizeInviteCode(code);
  if (clean) await AsyncStorage.setItem(INVITE_CODE_STORAGE_KEY, clean);
}

export async function readPendingInviteCode(): Promise<string | null> {
  return AsyncStorage.getItem(INVITE_CODE_STORAGE_KEY);
}

export async function clearPendingInviteCode(): Promise<void> {
  await AsyncStorage.removeItem(INVITE_CODE_STORAGE_KEY);
}

/** Extrae código de invitación de deep links habito:// o https://.../unirse?code= */
export function parseInviteCodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    if (code) return normalizeInviteCode(code);
  } catch {
    const match = url.match(/[?&]code=([^&]+)/i);
    if (match?.[1]) return normalizeInviteCode(decodeURIComponent(match[1]));
  }
  return null;
}

export async function linkClientByInviteCode(
  code: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const clean = normalizeInviteCode(code);
  if (!clean) return { ok: false, message: INVITE_LINK_FAILED_MESSAGE };

  const { error } = await supabase.rpc('link_client_by_invite_code', {
    p_invite_code: clean,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('invalid_invite_code')) return { ok: false, message: INVITE_LINK_FAILED_MESSAGE };
    if (msg.includes('trainer_cannot_be_client')) {
      return { ok: false, message: 'Esta cuenta es de entrenador. Usá otra cuenta de alumno.' };
    }
    return { ok: false, message: INVITE_LINK_FAILED_MESSAGE };
  }

  return { ok: true };
}

export async function applyPendingInviteLink(): Promise<boolean> {
  const code = await readPendingInviteCode();
  if (!code) return false;

  const result = await linkClientByInviteCode(code);
  if (result.ok) await clearPendingInviteCode();
  return result.ok;
}
