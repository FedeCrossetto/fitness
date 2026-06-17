/** Clave para persistir el código de invitación entre OAuth y registro. */
export const INVITE_CODE_STORAGE_KEY = 'habito_pending_invite_code';

/** Normaliza un código de invitación. */
export function normalizeInviteCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase();
}

/** Construye la URL pública de registro para un alumno. */
export function buildInviteLink(code: string, baseUrl: string): string {
  const clean = normalizeInviteCode(code);
  const base = baseUrl.replace(/\/$/, '');
  return clean ? `${base}/unirse?code=${encodeURIComponent(clean)}` : `${base}/unirse`;
}

export interface InvitePreview {
  app_name: string;
  logo_url: string | null;
  trainer_name: string | null;
  invite_code: string;
}
