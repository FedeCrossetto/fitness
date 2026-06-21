import { supabase } from '@/lib/supabase';

/** Convierte avatar_url de perfil en URL cargable (pública o path en bucket avatars). */
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.trim()) return null;
  const value = avatarUrl.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  const path = value.replace(/^avatars\//, '');
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}
