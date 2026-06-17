import {
  INVITE_CODE_STORAGE_KEY,
  buildInviteLink,
  normalizeInviteCode,
  type InvitePreview,
} from '@habito/shared';
import { supabase } from '@/lib/supabase';

export { INVITE_CODE_STORAGE_KEY, buildInviteLink, normalizeInviteCode, type InvitePreview };

const INVITE_URL_PARAM = 'invite';

const PRODUCTION_APP_URL = 'https://reset-fitness.vercel.app';

export function getJoinBaseUrl(): string {
  const configured =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_APP_DOWNLOAD_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const origin = window.location.origin;
  if (/localhost|127\.0\.0\.1/.test(origin)) return PRODUCTION_APP_URL;
  return origin;
}

export async function isClientLinked(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase
    .from('profiles')
    .select('trainer_id')
    .eq('id', session.user.id)
    .maybeSingle();
  return !!(data as { trainer_id: string | null } | null)?.trainer_id;
}

/** Vincula por código; si ya está vinculado, trata como éxito. */
export async function ensureClientLinked(code: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const link = await linkClientByInviteCode(code);
  if (link.ok) return { ok: true };
  if (await isClientLinked()) return { ok: true };
  return link;
}

export function savePendingInviteCode(code: string): void {
  const clean = normalizeInviteCode(code);
  if (!clean) return;
  sessionStorage.setItem(INVITE_CODE_STORAGE_KEY, clean);
  try {
    localStorage.setItem(INVITE_CODE_STORAGE_KEY, clean);
  } catch {
    /* private mode */
  }
}

/** Lee invite de ?invite= (OAuth callback), session/localStorage. */
export function readPendingInviteCode(): string | null {
  const fromUrl = normalizeInviteCode(new URLSearchParams(window.location.search).get(INVITE_URL_PARAM));
  if (fromUrl) return fromUrl;

  const fromSession = normalizeInviteCode(sessionStorage.getItem(INVITE_CODE_STORAGE_KEY));
  if (fromSession) return fromSession;

  try {
    return normalizeInviteCode(localStorage.getItem(INVITE_CODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearPendingInviteCode(): void {
  sessionStorage.removeItem(INVITE_CODE_STORAGE_KEY);
  try {
    localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function buildOAuthCallbackUrl(inviteCode: string): string {
  const clean = normalizeInviteCode(inviteCode);
  const base = `${window.location.origin}/auth/callback`;
  return clean ? `${base}?${INVITE_URL_PARAM}=${encodeURIComponent(clean)}` : base;
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
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
