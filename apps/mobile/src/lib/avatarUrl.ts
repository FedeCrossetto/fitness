import { supabase } from './supabase';

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
