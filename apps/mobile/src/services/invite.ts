import AsyncStorage from '@react-native-async-storage/async-storage';
import { INVITE_CODE_STORAGE_KEY, normalizeInviteCode } from '@habito/shared';
import { supabase } from '../lib/supabase';

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

export async function linkClientByInviteCode(code: string): Promise<boolean> {
  const clean = normalizeInviteCode(code);
  if (!clean) return false;

  const { error } = await supabase.rpc('link_client_by_invite_code', {
    p_invite_code: clean,
  });

  return !error;
}

export async function applyPendingInviteLink(): Promise<boolean> {
  const code = await readPendingInviteCode();
  if (!code) return false;

  const ok = await linkClientByInviteCode(code);
  if (ok) await clearPendingInviteCode();
  return ok;
}
